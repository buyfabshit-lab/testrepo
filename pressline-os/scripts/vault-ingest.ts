/**
 * Vault ingest (spec §7.5). Walks a source, dedupes by sha256, thumbnails,
 * tags by folder/brand, writes vault_assets. Resumable (progress file), batches of 500.
 *
 *   npm run vault:ingest -- --src /path/to/vault --brand death_corps --license mcg [--bucket-prefix vault] [--dry]
 *   npm run vault:ingest -- --src drive:<folderId> ...   (Drive source via service account; lists files recursively)
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, (GOOGLE_SERVICE_ACCOUNT_JSON for drive:)
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith("--") ? [a.slice(2), arr[i + 1]?.startsWith("--") || arr[i + 1] === undefined ? "true" : arr[i + 1]] : []).filter((x) => x.length));
const SRC = args.src, BRAND = args.brand ?? null, LICENSE = (args.license ?? "mcg") as "mcg" | "customer" | "camo";
const PREFIX = args["bucket-prefix"] ?? "vault", DRY = args.dry === "true", BATCH = 500;
if (!SRC) { console.error("--src required"); process.exit(1); }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) { console.error("Supabase env missing"); process.exit(1); }
const supa = createClient(url, key, { db: { schema: "pressline" }, auth: { persistSession: false } });
const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "artwork";
const progressFile = path.join(process.cwd(), `.vault-ingest.${createHash("md5").update(SRC).digest("hex").slice(0, 8)}.json`);
const done: Set<string> = new Set(fs.existsSync(progressFile) ? JSON.parse(fs.readFileSync(progressFile, "utf8")) : []);
const IMG = /\.(png|jpe?g|webp|gif|tiff?|svg)$/i;

function* walk(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (IMG.test(e.name)) yield p;
  }
}
function tagsFor(file: string): string[] {
  const rel = path.relative(SRC, file).split(path.sep).slice(0, -1);
  const base = path.basename(file).replace(/\.[^.]+$/, "");
  return Array.from(new Set([...rel, ...base.split(/[\s_\-]+/)].map((t) => t.toLowerCase()).filter((t) => t.length > 2 && t.length < 32)));
}

async function main() {
  if (SRC.startsWith("drive:")) { console.error("Drive source: list files with lib/drive then feed a local mirror; use `rclone`-free download via the Drive API (TODO when Drive creds land)."); process.exit(2); }
  const files = Array.from(walk(SRC));
  console.log(`[vault] ${files.length} files, ${done.size} already done, batch ${BATCH}${DRY ? " (dry run)" : ""}`);
  let n = 0, inserted = 0, dup = 0, failed = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    if (n >= BATCH) break;
    n++;
    try {
      const buf = fs.readFileSync(file);
      const hash = createHash("sha256").update(buf).digest("hex");
      const { data: exists } = await supa.from("vault_assets").select("id").eq("content_hash", hash).maybeSingle();
      if (exists) { dup++; done.add(file); continue; }
      const meta = await sharp(buf).metadata();
      const ext = path.extname(file).toLowerCase() || ".png";
      const storagePath = `${PREFIX}/${BRAND ?? "misc"}/${hash.slice(0, 2)}/${hash}${ext}`;
      const thumbPath = `${PREFIX}/thumbs/${hash}.webp`;
      if (!DRY) {
        const thumb = await sharp(buf).resize(400, 400, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
        const up1 = await supa.storage.from(bucket).upload(storagePath, buf, { contentType: `image/${ext.slice(1) === "jpg" ? "jpeg" : ext.slice(1)}`, upsert: true });
        if (up1.error) throw new Error(up1.error.message);
        const up2 = await supa.storage.from(bucket).upload(thumbPath, thumb, { contentType: "image/webp", upsert: true });
        if (up2.error) throw new Error(up2.error.message);
        const { error } = await supa.from("vault_assets").insert({ storage_path: storagePath, brand: BRAND, title: path.basename(file).replace(/\.[^.]+$/, ""), tags: tagsFor(file), dpi: meta.density ?? null, license: LICENSE, thumb_url: thumbPath, content_hash: hash });
        if (error) throw new Error(error.message);
      }
      inserted++; done.add(file);
    } catch (e) {
      failed++; console.warn(`[vault] ${file}: ${e instanceof Error ? e.message : e}`);
    }
    if (n % 50 === 0) { fs.writeFileSync(progressFile, JSON.stringify(Array.from(done))); console.log(`[vault] ${n}/${BATCH} this run · +${inserted} · dup ${dup} · failed ${failed}`); }
  }
  fs.writeFileSync(progressFile, JSON.stringify(Array.from(done)));
  console.log(`[vault] done: +${inserted} inserted, ${dup} duplicates, ${failed} failed, ${files.length - done.size} remaining (re-run to continue)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
