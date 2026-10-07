import { bad, json, params, staffRoute } from "@/lib/api";
import { db } from "@/lib/supabase/service";
import { env, moneyIsLive } from "@/lib/env";
import { placeOrder, type SSOrderRequest } from "@/lib/ss";
import { logEvent, transition } from "@/lib/orders/service";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Owner approval tap. Real S&S PO only when LIVE_MONEY=true; otherwise a dry run that shows the exact payload. */
export const POST = staffRoute<Ctx>(["owner"], async (_req, ctx, staff) => {
  const { id } = await params(ctx);
  const { data: po } = await db().from("purchase_orders").select("*, order:orders(id, number)").eq("id", id).maybeSingle();
  if (!po) return bad("not found", 404);
  if (po.status !== "pending_approval") return bad(`PO is ${po.status}`, 409);
  const now = new Date().toISOString();
  const payload = (po.lines as { lines: Array<{ identifier: string; qty: number }>; ship_to: SSOrderRequest["shippingAddress"] | null }) ?? { lines: [], ship_to: null };

  if (po.supplier !== "ss") {
    await db().from("purchase_orders").update({ status: "placed", approved_by: staff.userId, approved_at: now }).eq("id", id);
    await logEvent({ orderId: po.order_id, actor: "justin", kind: "po", msg: `PO approved for ${po.supplier} — send by email template`, data: { po_id: id } });
    return json({ ok: true, placed: false, manual: true });
  }
  if (!payload.ship_to) return bad("PO has no ship-to address", 422);
  const req: SSOrderRequest = { shippingAddress: payload.ship_to, shippingMethod: "1", poNumber: `MF-${po.order?.number ?? po.id.slice(0, 6)}`, emailConfirmation: env.justinEmail() || "orders@midnightfusion.co", testOrder: !moneyIsLive(), autoselectWarehouse: true, lines: payload.lines };
  const result = await placeOrder(req);
  if (result.placed) {
    const supplierPo = (result.response as { orders?: Array<{ orderNumber?: string }> })?.orders?.[0]?.orderNumber ?? null;
    await db().from("purchase_orders").update({ status: "placed", supplier_po: supplierPo, approved_by: staff.userId, approved_at: now }).eq("id", id);
    await logEvent({ orderId: po.order_id, actor: "justin", kind: "po", msg: `S&S PO placed${supplierPo ? ` (${supplierPo})` : ""}`, data: { po_id: id } });
    if (po.order_id) await transition(po.order_id, "BLANKS_ORDERED", { actor: "justin", reason: "S&S PO placed" }).catch(() => null);
    return json({ ok: true, placed: true, supplier_po: supplierPo });
  }
  await db().from("purchase_orders").update({ approved_by: staff.userId, approved_at: now }).eq("id", id);
  await logEvent({ orderId: po.order_id, actor: "justin", kind: "po", msg: "PO approved but LIVE_MONEY=false — dry run only, nothing sent to S&S", data: { po_id: id, dry_run: result.response } });
  return json({ ok: true, placed: false, dry_run: true, would_send: result.response });
});
