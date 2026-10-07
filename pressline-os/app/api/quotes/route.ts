import { z } from "zod";
import { json, staffOrSignedRoute, staffRoute } from "@/lib/api";
import { db } from "@/lib/supabase/service";
import { logEvent } from "@/lib/orders/service";
import { LineSchema, priceLines } from "@/lib/quotes";

export const dynamic = "force-dynamic";
const Body = z.object({ customer_id: z.string().uuid(), lines: z.array(LineSchema).min(1), rush: z.boolean().default(false), dry_run: z.boolean().default(false) });

export const GET = staffRoute(undefined, async () => {
  const { data, error } = await db().from("quotes").select("*, customer:customers(id,name,company,email)").order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return json({ quotes: data });
});

export const POST = staffOrSignedRoute(undefined, async (_req, _ctx, staff, raw) => {
  const b = Body.parse(raw ?? {});
  const priced = await priceLines(b.lines, b.rush);
  if (b.dry_run) return json({ quote: { lines: priced.lines, subtotal: priced.subtotal, total: priced.total } });
  const { data, error } = await db().from("quotes").insert({ customer_id: b.customer_id, lines: priced.lines as never, subtotal: priced.subtotal, total: priced.total, status: "draft" }).select("*").single();
  if (error) throw new Error(error.message);
  await logEvent({ actor: staff.name ?? staff.role, kind: "quote", msg: `Quote ${data.id.slice(0, 8)} drafted — $${priced.total.toFixed(2)}`, data: { quote_id: data.id } });
  return json({ quote: data }, 201);
});
