import { z } from "zod";
import { bad, clientIp, json, parse, rateLimit, route } from "@/lib/api";
import { removeFlatBackground } from "@/lib/imaging";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const Body = z.object({ png_base64: z.string().min(50), tolerance: z.number().min(0).max(120).optional() });
export const POST = route(async (req) => {
  if (!rateLimit(`img:${clientIp(req)}`, 20, 60_000)) return bad("slow down", 429);
  const b = await parse(req, Body);
  const out = await removeFlatBackground(Buffer.from(b.png_base64.replace(/^data:image\/\w+;base64,/, ""), "base64"), b.tolerance);
  return json({ png_base64: out.toString("base64") });
});
