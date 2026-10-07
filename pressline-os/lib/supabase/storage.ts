import "server-only";
import { env } from "@/lib/env";
import { serviceClient } from "./service";

/** Private `artwork` bucket helpers. Signed URLs only (spec §5). */
export async function putObject(path: string, data: Buffer | Uint8Array, contentType: string): Promise<string> {
  const { error } = await serviceClient().storage.from(env.storageBucket()).upload(path, data, { contentType, upsert: true });
  if (error) throw new Error(`storage upload ${path}: ${error.message}`);
  return path;
}

export async function getObject(path: string): Promise<Buffer> {
  const { data, error } = await serviceClient().storage.from(env.storageBucket()).download(path);
  if (error || !data) throw new Error(`storage download ${path}: ${error?.message ?? "empty"}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function signedUrl(path: string, expiresSec = 3600): Promise<string> {
  const { data, error } = await serviceClient().storage.from(env.storageBucket()).createSignedUrl(path, expiresSec);
  if (error || !data) throw new Error(`signed url ${path}: ${error?.message ?? "empty"}`);
  return data.signedUrl;
}

export async function signedUrls(paths: string[], expiresSec = 3600): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await serviceClient().storage.from(env.storageBucket()).createSignedUrls(paths, expiresSec);
  if (error || !data) throw new Error(`signed urls: ${error?.message ?? "empty"}`);
  const out: Record<string, string> = {};
  for (const d of data) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}
