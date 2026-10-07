/**
 * Vault ingest (spec §7.5). Walks a source, dedupes by sha256, thumbnails,
 * tags by folder/brand, writes vault_assets. Resumable (progress file), batches of 500.
 *
 *   npm run vault:ingest -- --src /path/to/vault --brand death_corps --license mcg [--batch 500] [--dry]
 *   npm run vault:ingest -- --src drive:<folderId> --brand death_corps --license mcg
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (skipped with --dry),
 *      GOOGLE_SERVICE_ACCOUNT_JSON for drive: sources (folder shared with the service account).
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { downloadFile, driveConfigured, walkFolder, type DriveFile } from "../lib/drive/core";

const argv = process.argv.slice(2);
const args: Record<string, string> = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
const SRC = args.src, BRAND = args.brand ?? null, LICENSE = (args.license ?? "mcg") as "mcg" | "customer" | "camo";
const PREFIX = args["bucket-prefix"] ?? "vault", DRY = args.dry === "true", BATCH = Number(args.batch) || 500;
if (!SRC) { console.error("--src <folder | drive:folderId> required"); process.exit(1); }
const IMG = /\.(png|jpe?g|webp|gif|tiff?|svg)$/i;
const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "artwork";
const progressFile = path.join(process.cwd(), `.vault-ingest.${createHash("md5").update(SRC).digest("hex").slice(0, 8)}.json`);
const done = new Set<string>(fs.existsSync(progressFile) ? JSON.parse(fs.readFileSync(progressFile, "utf8")) : []);

interface Item { key: string; name: string; folders: string[]; read: () => Promise<Buffer> }

function* walkLocal(dir: string, rel: string[] = []): Generator<Item> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkLocal(p, [...rel, e.name]);
    else if (IMG.test(e.name)) yield { key: p, name: e.name, folders: rel, read: async () => fs.readFileSync(p) };
  }
}
async function* walkDrive(folderId: string): AsyncGenerator<Item> {
  if (!driveConfigured()) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON missing — share the folder with the service account and set the env var");
  for await (const { file, path: folders } of walkFolder(folderId)) {
    const f: DriveFile = file;
    if (!IMG.test(f.name) && !f.mimeType.startsWith("image/")) continue;
    yield { key: `drive:${f.id}`, name: f.name, folders, read: () => downloadFile(f.id) };
  }
}
function tagsFor(it: Item): string[] {
  const base = it.name.replace(/\.[^.]+$/, "");
  return Array.from(new Set([...it.folders, ...base.split(/[\s_\-]+/)].map((t) => t.toLowerCase()).filter((t) => t.length > 2 && t.length < 32)));
}

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supa: SupabaseClient<any, "pressline", any> | null = null;
  if (!DRY) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) { console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (or use --dry)"); process.exit(1); }
    supa = createClient(url, key, { db: { schema: "pressline" }, auth: { persistSession: false } });
  }
  const source = SRC.startsWith("drive:") ? walkDrive(SRC.slice(6)) : walkLocal(SRC);
  console.log(`[vault] source=${SRC} brand=${BRAND ?? "-"} license=${LICENSE} batch=${BATCH} resume=${done.size}${DRY ? " DRY RUN (no DB, no uploads)" : ""}`);
  let n = 0, inserted = 0, dup = 0, failed = 0;
  const seenHashes = new Set<string>();
  for await (const it of source) {
    if (done.has(it.key)) continue;
    if (n >= BATCH) break;
    n++;
    try {
      const buf = await it.read();
      const hash = createHash("sha256").update(buf).digest("hex");
      if (seenHashes.has(hash)) { dup++; done.add(it.key); continue; }
      seenHashes.add(hash);
      if (supa) {
        const { data: exists } = await supa.from("vault_assets").select("id").eq("content_hash", hash).maybeSingle();
        if (exists) { dup++; done.add(it.key); continue; }
      }
      const meta = await sharp(buf).metadata();
      const ext = (path.extname(it.name).toLowerCase() || ".png").replace(".jpeg", ".jpg");
      const storagePath = `${PREFIX}/${BRAND ?? "misc"}/${hash.slice(0, 2)}/${hash}${ext}`;
      const thumbPath = `${PREFIX}/thumbs/${hash}.webp`;
      const thumb = await sharp(buf).resize(400, 400, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      const row = { storage_path: storagePath, brand: BRAND, title: it.name.replace(/\.[^.]+$/, ""), tags: tagsFor(it), dpi: meta.density ?? null, license: LICENSE, thumb_url: thumbPath, content_hash: hash };
      if (supa) {
        const mime = ext === ".jpg" ? "image/jpeg" : ext === ".svg" ? "image/svg+xml" : `image/${ext.slice(1)}`;
        const up1 = await supa.storage.from(bucket).upload(storagePath, buf, { contentType: mime, upsert: true });
        if (up1.error) throw new Error(up1.error.message);
        const up2 = await supa.storage.from(bucket).upload(thumbPath, thumb, { contentType: "image/webp", upsert: true });
        if (up2.error) throw new Error(up2.error.message);
        const { error } = await supa.from("vault_assets").insert(row);
        if (error) throw new Error(error.message);
      } else {
        console.log(`[dry] ${it.name} → ${storagePath} (${meta.width}×${meta.height}, ${meta.density ?? "?"} dpi, thumb ${thumb.length}B) tags=${row.tags.join(",")}`);
      }
      inserted++; done.add(it.key);
    } catch (e) {
      failed++; console.warn(`[vault] ${it.name}: ${e instanceof Error ? e.message : e}`);
    }
    if (n % 50 === 0) { if (!DRY) fs.writeFileSync(progressFile, JSON.stringify(Array.from(done))); console.log(`[vault] ${n}/${BATCH} · +${inserted} · dup ${dup} · failed ${failed}`); }
  }
  if (!DRY) fs.writeFileSync(progressFile, JSON.stringify(Array.from(done)));
  console.log(`[vault] done: +${inserted} ${DRY ? "would insert" : "inserted"}, ${dup} duplicates, ${failed} failed, ${n} processed this run (re-run to continue; progress in ${path.basename(progressFile)})`);
}
main().catch((e) => { console.error(e); process.exit(1); });
