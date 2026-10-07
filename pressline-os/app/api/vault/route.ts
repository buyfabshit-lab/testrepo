import { json, staffRoute } from "@/lib/api";
import { search } from "@/lib/vault";
export const dynamic = "force-dynamic";
export const GET = staffRoute(undefined, async (req) => {
  const p = new URL(req.url).searchParams;
  const tags = (p.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  return json(await search({ q: p.get("q") ?? undefined, brand: p.get("brand") ?? undefined, license: p.get("license") ?? undefined, tags, limit: Math.min(200, Number(p.get("limit")) || 60), offset: Number(p.get("offset")) || 0 }));
});
