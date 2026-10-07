import { bad, clientIp, json, officeSession, rateLimit, route } from "@/lib/api";
import { currentStaff } from "@/lib/auth/staff";
import { SIGNATURE_HEADER, verify } from "@/lib/n8n/sign";
import { search } from "@/lib/vault";
export const dynamic = "force-dynamic";

/** Vault search. Staff/n8n: everything. Anyone else (the studio): license-filtered, no MCG, rate-limited, signed URLs for placing. */
export const GET = route(async (req) => {
  const p = new URL(req.url).searchParams;
  const tags = (p.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const privileged = verify("", req.headers.get(SIGNATURE_HEADER)) || Boolean((await currentStaff()) ?? (await officeSession()));
  if (!privileged && !rateLimit(`vault:${clientIp(req)}`, 60, 60_000)) return bad("slow down", 429);
  return json(await search({
    q: p.get("q") ?? undefined, brand: p.get("brand") ?? undefined, license: p.get("license") ?? undefined, tags,
    limit: Math.min(privileged ? 200 : 60, Number(p.get("limit")) || 60), offset: Number(p.get("offset")) || 0,
    context: privileged ? undefined : "customer_studio", withUrls: true,
  }));
});
