import { bad, json, params, staffRoute } from "@/lib/api";
import { db } from "@/lib/supabase/service";
import { getOrder } from "@/lib/orders/service";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export const GET = staffRoute<Ctx>(undefined, async (_req, ctx) => {
  const { id } = await params(ctx);
  const order = await getOrder(id);
  if (!order) return bad("not found", 404);
  const [{ data: events }, { data: shipments }, { data: invoices }, { data: pos }] = await Promise.all([
    db().from("events").select("*").eq("order_id", id).order("ts", { ascending: false }).limit(100),
    db().from("shipments").select("*").eq("order_id", id),
    db().from("invoices").select("*").eq("order_id", id),
    db().from("purchase_orders").select("*").eq("order_id", id),
  ]);
  return json({ order: { ...order, events: events ?? [], shipments: shipments ?? [], invoices: invoices ?? [], purchase_orders: pos ?? [] } });
});
