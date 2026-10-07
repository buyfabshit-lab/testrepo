import { z } from "zod";
import { bad, json, staffOrSignedRoute } from "@/lib/api";
import { ensure300Dpi, removeFlatBackground } from "@/lib/imaging";
import { putObject, signedUrl } from "@/lib/supabase/storage";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const Body = z.object({ url: z.string().url().optional(), png_base64: z.string().min(50).optional(), width_in: z.number().positive().max(22).default(10), remove_bg: z.boolean().default(true), key: z.string().max(80).optional() });

/** n8n "clean art": fetch a logo (or take base64) → flat-BG removal → 300 DPI → Storage → signed URL. */
export const POST = staffOrSignedRoute(undefined, async (_req, _ctx, _staff, raw) => {
  const b = Body.parse(raw ?? {});
  let buf: Buffer;
  if (b.png_base64) buf = Buffer.from(b.png_base64.replace(/^data:image\/\w+;base64,/, ""), "base64");
  else if (b.url) {
    const res = await fetch(b.url);
    if (!res.ok) return bad(`fetch ${res.status}`, 422);
    buf = Buffer.from(await res.arrayBuffer());
  } else return bad("url or png_base64 required", 422);
  if (b.remove_bg) buf = await removeFlatBackground(buf).catch(() => buf);
  const r = await ensure300Dpi(buf, b.width_in);
  const path = `clean/${b.key ?? Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.png`;
  await putObject(path, r.png, "image/png");
  return json({ png_url: await signedUrl(path, 7 * 24 * 3600), storage_path: path, source_dpi: r.sourceDpi, warning: r.warning ?? null });
});
