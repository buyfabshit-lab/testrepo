import { z } from "zod";
import { json, staffOrSignedRoute } from "@/lib/api";
import { db } from "@/lib/supabase/service";
import { isOrderStatus } from "@/lib/orders/status";
import { listOrders, logEvent, newProofToken } from "@/lib/orders/service";

export const dynamic = "force-dynamic";
const Body = z.object({
  customer_id: z.string().uuid(),
  lines: z.array(z.object({ blank_id: z.string().uuid().optional().nullable(), sizes: z.record(z.string(), z.number().int().nonnegative()).default({}), design_id: z.string().uuid().optional().nullable(), locations: z.array(z.string()).default(["front"]), unit_price: z.number().nonnegative().optional().nullable() })).min(1),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  rush: z.boolean().default(false),
  store_id: z.string().uuid().optional().nullable(),
});

export const GET = staffOrSignedRoute(undefined, async (req) => {
  const p = new URL(req.url).searchParams;
  const status = p.get("status"), customerId = p.get("customer_id");
  let orders = await listOrders({ status: isOrderStatus(status) ? status : undefined });
  if (customerId) orders = orders.filter((o) => o.customer_id === customerId);
  return json({ orders });
});

export const POST = staffOrSignedRoute(undefined, async (_req, _ctx, staff, raw) => {
  const b = Body.parse(raw ?? {});
  const { data: order, error } = await db().from("orders").insert({ customer_id: b.customer_id, due_date: b.due_date ?? null, rush: b.rush, store_id: b.store_id ?? null, proof_token: newProofToken(), status: "NEW" }).select("*").single();
  if (error) throw new Error(error.message);
  await db().from("order_lines").insert(b.lines.map((l) => ({ order_id: order.id, blank_id: l.blank_id ?? null, sizes: l.sizes as never, design_id: l.design_id ?? null, locations: l.locations, unit_price: l.unit_price ?? null })));
  await logEvent({ orderId: order.id, actor: staff.name ?? staff.role, kind: "order", msg: `Order #${order.number} created`, data: { lines: b.lines.length } });
  return json({ order }, 201);
});
