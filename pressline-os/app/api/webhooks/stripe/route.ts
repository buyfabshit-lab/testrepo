import { bad, json, route } from "@/lib/api";
import { constructWebhookEvent } from "@/lib/stripe";
import { db } from "@/lib/supabase/service";
import { logEvent, transition } from "@/lib/orders/service";
import { postToN8n } from "@/lib/n8n/sign";
export const dynamic = "force-dynamic";

/** Stripe → PAID. Signature-verified. Idempotent on invoices.paid_at. */
export const POST = route(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return bad("missing signature", 400);
  const raw = await req.text();
  let event;
  try { event = constructWebhookEvent(raw, sig); } catch (e) { return bad(`bad signature: ${e instanceof Error ? e.message : e}`, 400); }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const orderId = s.metadata?.pressline_order_id;
    const storeOrderId = s.metadata?.pressline_store_order_id;
    const now = new Date().toISOString();
    if (orderId) {
      await db().from("invoices").update({ paid_at: now }).eq("stripe_checkout_session_id", s.id).is("paid_at", null);
      await logEvent({ orderId, actor: "system", kind: "stripe", msg: `Paid via Checkout ($${((s.amount_total ?? 0) / 100).toFixed(2)}, ${event.livemode ? "LIVE" : "test"})`, data: { session: s.id } });
      await transition(orderId, "PAID", { actor: "system", reason: "stripe checkout", force: true }).catch((e) => console.warn("[stripe]", e));
    } else if (storeOrderId) {
      await db().from("store_orders").update({ paid_at: now }).eq("id", storeOrderId);
      await logEvent({ actor: "system", kind: "stripe", msg: `Store order paid ($${((s.amount_total ?? 0) / 100).toFixed(2)})`, data: { store_order_id: storeOrderId, session: s.id } });
    }
  } else if (event.type === "invoice.paid") {
    const inv = event.data.object;
    const orderId = inv.metadata?.pressline_order_id;
    if (orderId) {
      await db().from("invoices").upsert({ order_id: orderId, stripe_invoice_id: inv.id, amount: (inv.amount_paid ?? 0) / 100, paid_at: new Date().toISOString() }, { onConflict: "stripe_invoice_id" }).then(() => null, () => null);
      await logEvent({ orderId, actor: "system", kind: "stripe", msg: `Invoice paid ($${((inv.amount_paid ?? 0) / 100).toFixed(2)})`, data: { invoice: inv.id } });
      await transition(orderId, "PAID", { actor: "system", reason: "stripe invoice", force: true }).catch(() => null);
    }
  }
  void postToN8n("pressline/stripe", { type: event.type, id: event.id, livemode: event.livemode });
  return json({ received: true });
});
