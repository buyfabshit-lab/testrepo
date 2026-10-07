import { z } from "zod";
import { bad, clientIp, json, parse, rateLimit, route } from "@/lib/api";
import { ensure300Dpi } from "@/lib/imaging";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const Body = z.object({ png_base64: z.string().min(50), width_in: z.number().positive().max(22) });
export const POST = route(async (req) => {
  if (!rateLimit(`img:${clientIp(req)}`, 20, 60_000)) return bad("slow down", 429);
  const b = await parse(req, Body);
  const r = await ensure300Dpi(Buffer.from(b.png_base64.replace(/^data:image\/\w+;base64,/, ""), "base64"), b.width_in);
  return json({ png_base64: r.png.toString("base64"), source_dpi: r.sourceDpi, upscaled: r.upscaled, warning: r.warning ?? null });
});
