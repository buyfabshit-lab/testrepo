import { json, route } from "@/lib/api";
import { db } from "@/lib/supabase/service";
export const dynamic = "force-dynamic";
/** Public intercom feed: Outlaw's last lines (no PII, no costs — his lines only carry order numbers). */
export const GET = route(async (req) => {
  const limit = Math.min(50, Number(new URL(req.url).searchParams.get("limit")) || 20);
  const { data } = await db().from("events").select("id, msg, ts, data").eq("actor", "outlaw").order("ts", { ascending: false }).limit(limit);
  return json({ messages: (data ?? []).filter((e) => !(e.msg ?? "").startsWith("→")).map((e) => ({ id: e.id, text: e.msg, at: e.ts })) }, { headers: { "cache-control": "no-store" } });
});
