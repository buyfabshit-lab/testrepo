import { z } from "zod";
import { json, parse, staffRoute } from "@/lib/api";
import { db } from "@/lib/supabase/service";
import { logEvent } from "@/lib/orders/service";
export const dynamic = "force-dynamic";
const Body = z.object({
  order_id: z.string().uuid(), supplier: z.enum(["ss", "sanmar", "unity", "danny", "oceanaire", "other"]).default("ss"),
  lines: z.array(z.object({ identifier: z.string().min(1), qty: z.number().int().positive(), note: z.string().optional() })).min(1),
  ship_to: z.object({ customer: z.string(), attn: z.string().optional(), address: z.string(), city: z.string(), state: z.string(), zip: z.string() }).optional(),
});
/** Create a PO — ALWAYS pending_approval. Nothing is sent here. */
export const POST = staffRoute(undefined, async (req, _ctx, staff) => {
  const b = await parse(req, Body);
  const { data, error } = await db().from("purchase_orders").insert({ order_id: b.order_id, supplier: b.supplier, lines: { lines: b.lines, ship_to: b.ship_to ?? null } as never, status: "pending_approval" }).select("*").single();
  if (error) throw new Error(error.message);
  await logEvent({ orderId: b.order_id, actor: staff.name ?? staff.role, kind: "po", msg: `PO drafted for ${b.supplier} (${b.lines.length} line(s)) — pending approval`, data: { po_id: data.id } });
  return json({ po: data }, 201);
});
