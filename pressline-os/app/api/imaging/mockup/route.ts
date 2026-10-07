import { z } from "zod";
import sharp from "sharp";
import { bad, json, staffOrSignedRoute } from "@/lib/api";
import { getObject, putObject, signedUrl } from "@/lib/supabase/storage";
import { db } from "@/lib/supabase/service";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const Body = z.object({
  art_url: z.string().url().optional(), art_storage_path: z.string().optional(),
  blank: z.enum(["tee", "hoodie", "hat"]).default("tee"), color: z.string().default("Black"), blank_photo_url: z.string().url().optional(),
  key: z.string().max(80).optional(),
});

const COLORS: Record<string, string> = { black: "#111111", white: "#f4f4f4", navy: "#1f2a44", red: "#8b1a1a", grey: "#6b6b6b", heather: "#8a8a8a", sand: "#d8c9a5" };
/** Fallback flat garment when there's no S&S photo: a simple silhouette in the chosen color. */
function silhouette(blank: "tee" | "hoodie" | "hat", color: string): Buffer {
  const fill = COLORS[color.toLowerCase()] ?? "#111111";
  const body = blank === "hat"
    ? `<path d="M200 520 Q200 300 500 300 Q800 300 800 520 L800 600 Q500 660 200 600 Z" fill="${fill}"/><path d="M120 600 Q500 700 880 600 L900 650 Q500 760 100 650 Z" fill="${fill}" opacity=".85"/>`
    : `<path d="M300 150 L420 100 Q500 160 580 100 L700 150 L860 260 L780 380 L700 330 L700 900 L300 900 L300 330 L220 380 L140 260 Z" fill="${fill}"/>${blank === "hoodie" ? `<path d="M420 100 Q500 40 580 100 Q500 200 420 100Z" fill="${fill}" stroke="#000" stroke-opacity=".25"/>` : ""}`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000"><rect width="1000" height="1000" fill="#0d0c0a"/>${body}</svg>`);
}

/** n8n "mockup": composite art onto a blank (S&S photo URL, cached blank photo, or drawn silhouette). */
export const POST = staffOrSignedRoute(undefined, async (_req, _ctx, _staff, raw) => {
  const b = Body.parse(raw ?? {});
  let art: Buffer;
  if (b.art_storage_path) art = await getObject(b.art_storage_path);
  else if (b.art_url) { const r = await fetch(b.art_url); if (!r.ok) return bad(`art fetch ${r.status}`, 422); art = Buffer.from(await r.arrayBuffer()); }
  else return bad("art_url or art_storage_path required", 422);

  let photoUrl = b.blank_photo_url ?? null;
  if (!photoUrl) {
    const style = b.blank === "hoodie" ? "18500" : b.blank === "hat" ? "6006" : "5000";
    const { data: blank } = await db().from("blanks").select("photo_front").eq("style", style).ilike("color", b.color).maybeSingle();
    photoUrl = blank?.photo_front ?? null;
  }
  let base: Buffer;
  if (photoUrl) { const r = await fetch(photoUrl); base = r.ok ? Buffer.from(await r.arrayBuffer()) : silhouette(b.blank, b.color); } else base = silhouette(b.blank, b.color);
  const canvas = await sharp(base).resize(1000, 1000, { fit: "contain", background: "#0d0c0a" }).png().toBuffer();
  const area = b.blank === "hat" ? { left: 390, top: 360, w: 220, h: 110 } : { left: 330, top: 300, w: 340, h: 450 };
  const fitted = await sharp(art).resize(area.w, area.h, { fit: "inside" }).png().toBuffer();
  const m = await sharp(fitted).metadata();
  const out = await sharp(canvas).composite([{ input: fitted, left: area.left + Math.round((area.w - (m.width ?? 0)) / 2), top: area.top + Math.round((area.h - (m.height ?? 0)) / 2), blend: "multiply" }]).jpeg({ quality: 88 }).toBuffer();
  const path = `mockups/${b.key ?? Date.now().toString(36)}-${b.blank}-${b.color.toLowerCase().replace(/[^a-z0-9]/g, "")}.jpg`;
  await putObject(path, out, "image/jpeg");
  return json({ mockup_url: await signedUrl(path, 7 * 24 * 3600), storage_path: path, blank_photo: Boolean(photoUrl) });
});
