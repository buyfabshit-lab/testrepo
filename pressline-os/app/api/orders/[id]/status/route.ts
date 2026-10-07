import { z } from "zod";
import { bad, json, params, parse, staffRoute } from "@/lib/api";
import { actorFor } from "@/lib/auth/staff";
import { isOrderStatus } from "@/lib/orders/status";
import { transition } from "@/lib/orders/service";
import { say, pingFor } from "@/lib/outlaw";
import { db } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ status: z.string(), reason: z.string().max(500).optional(), force: z.boolean().optional() });

export const PATCH = staffRoute<Ctx>(undefined, async (req, ctx, staff) => {
  const { id } = await params(ctx);
  const b = await parse(req, Body);
  if (!isOrderStatus(b.status)) return bad(`unknown status ${b.status}`, 422);
  // Only owners may force (skip the state machine); the floor follows it.
  const force = Boolean(b.force) && staff.role === "owner";
  const order = await transition(id, b.status, { actor: actorFor(staff), reason: b.reason, force });
  const { data: cust } = order.customer_id ? await db().from("customers").select("name, company").eq("id", order.customer_id).maybeSingle() : { data: null };
  for (const p of pingFor(b.status, order.number, { customer: cust?.company ?? cust?.name ?? null, due: order.due_date })) {
    await say(order.id, `→ ${p.to}: ${p.text}`, { to: p.to, status: b.status });
  }
  return json({ order });
});
