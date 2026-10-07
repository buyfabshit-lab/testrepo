import { SignJWT, importPKCS8 } from "jose";
import { env } from "@/lib/env";
import { DRIVE_FOLDERS } from "@/lib/naming";

/**
 * Google Drive core — NO "server-only" import so CLI scripts (vault ingest) can use it.
 * App code imports from "@/lib/drive" (the server-only wrapper).
 *
 * Google Drive mirror (spec rule 5): every file lands in Storage AND Drive
 * FUSION INTAKE. Service account (GOOGLE_SERVICE_ACCOUNT_JSON) — the folder
 * must be shared with the service account email. No OAuth dance, no rclone,
 * nothing from Manus.
 */
const SCOPE = "https://www.googleapis.com/auth/drive";
const FOLDER_MIME = "application/vnd.google-apps.folder";

let tokenCache: { token: string; exp: number } | null = null;
const folderCache = new Map<string, string>();

interface ServiceAccount { client_email: string; private_key: string; token_uri?: string }

function account(): ServiceAccount | null {
  const raw = env.googleServiceAccountJson();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    // Railway sometimes stores the JSON base64-encoded.
    try { return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as ServiceAccount; } catch { return null; }
  }
}

export function driveConfigured(): boolean {
  return Boolean(account() && env.driveFusionIntakeId());
}

export async function accessToken(): Promise<string> {
  const sa = account();
  if (!sa) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.exp - 60 > now) return tokenCache.token;
  const key = await importPKCS8(sa.private_key, "RS256");
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email).setSubject(sa.client_email)
    .setAudience(sa.token_uri ?? "https://oauth2.googleapis.com/token")
    .setIssuedAt(now).setExpirationTime(now + 3600)
    .sign(key);
  const res = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) throw new Error(`Drive auth failed: ${json.error ?? res.status}`);
  tokenCache = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return json.access_token;
}

async function api<T>(path: string, init: RequestInit & { query?: Record<string, string> } = {}): Promise<T> {
  const token = await accessToken();
  const url = new URL(`https://www.googleapis.com/${path}`);
  url.searchParams.set("supportsAllDrives", "true");
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`Drive ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

/** Find-or-create a child folder. Cached per process. */
export async function ensureFolder(parentId: string, name: string): Promise<string> {
  const key = `${parentId}/${name}`;
  const hit = folderCache.get(key);
  if (hit) return hit;
  const q = `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const found = await api<{ files: Array<{ id: string }> }>("drive/v3/files", {
    query: { q, fields: "files(id)", includeItemsFromAllDrives: "true" },
  });
  let id = found.files[0]?.id;
  if (!id) {
    const created = await api<{ id: string }>("drive/v3/files", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
      query: { fields: "id" },
    });
    id = created.id;
  }
  folderCache.set(key, id);
  return id;
}

/** Resolve a path like ["01 TO GANG SHEET", "2026-10-07"] under FUSION INTAKE. */
export async function folderPath(segments: string[]): Promise<string> {
  let parent = env.driveFusionIntakeId();
  for (const s of segments) parent = await ensureFolder(parent, s);
  return parent;
}

/** Multipart upload. Returns the Drive file id + link. */
export async function uploadFile(input: { folderId: string; name: string; mimeType: string; data: Buffer }): Promise<{ id: string; webViewLink: string }> {
  const token = await accessToken();
  const boundary = `pl${Date.now().toString(36)}`;
  const meta = JSON.stringify({ name: input.name, parents: [input.folderId] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\ncontent-type: ${input.mimeType}\r\n\r\n`),
    input.data,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`Drive upload → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as { id: string; webViewLink: string };
}

/** Mirror a buffer into a FUSION INTAKE subfolder. Returns null (and logs) when Drive isn't configured. */
export async function mirror(input: { path: string[]; name: string; mimeType: string; data: Buffer }): Promise<{ id: string; webViewLink: string } | null> {
  if (!driveConfigured()) {
    console.warn(`[drive] not configured; NOT mirrored: ${input.path.join("/")}/${input.name}`);
    return null;
  }
  const folderId = await folderPath(input.path);
  return uploadFile({ folderId, name: input.name, mimeType: input.mimeType, data: input.data });
}

export interface DriveFile { id: string; name: string; mimeType: string; size?: string; md5Checksum?: string; parents?: string[] }

/** List a folder (non-recursive, paged). */
export async function listFolder(folderId: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const page = await api<{ files: DriveFile[]; nextPageToken?: string }>("drive/v3/files", {
      query: { q: `'${folderId}' in parents and trashed = false`, fields: "nextPageToken, files(id, name, mimeType, size, md5Checksum, parents)", pageSize: "1000", includeItemsFromAllDrives: "true", ...(pageToken ? { pageToken } : {}) },
    });
    out.push(...page.files);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}

/** Walk a folder tree. Yields files with the relative folder path (for tagging). */
export async function* walkFolder(folderId: string, path: string[] = []): AsyncGenerator<{ file: DriveFile; path: string[] }> {
  for (const f of await listFolder(folderId)) {
    if (f.mimeType === FOLDER_MIME) yield* walkFolder(f.id, [...path, f.name]);
    else yield { file: f, path };
  }
}

export async function downloadFile(fileId: string): Promise<Buffer> {
  const token = await accessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive download ${fileId} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Share a folder with Danny / Jeff by email (reader). */
export async function shareWith(fileId: string, email: string, role: "reader" | "writer" = "reader"): Promise<void> {
  await api("drive/v3/files/" + fileId + "/permissions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "user", role, emailAddress: email }),
    query: { sendNotificationEmail: "true" },
  });
}

export { DRIVE_FOLDERS };
