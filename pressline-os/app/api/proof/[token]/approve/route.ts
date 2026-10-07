import { bad, json, params, route } from "@/lib/api";
import { db } from "@/lib/supabase/service";
import { getOrderByProofToken, logEvent } from "@/lib/orders/service";
import { createOrderCheckout, stripeConfigured } from "@/lib/stripe";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ token: string }> };

/** Customer approves: lock every design on the order (approval-lock), then Stripe Checkout (test mode unless LIVE_MONEY). */
export const POST = route<Ctx>(async (_req, ctx) => {
  const { token } = await params(ctx);
  const order = await getOrderByProofToken(token);
  if (!order) return bad("not found", 404);
  if (!["QUOTED", "APPROVED"].includes(order.status ?? "")) return bad(`order is ${order.status}; nothing to approve`, 409);
  const total = Number(order.quote?.total ?? 0);
  if (!(total > 0)) return bad("quote has no total yet", 409);

  const now = new Date().toISOString();
  const designIds = (order.lines ?? []).map((l) => l.design?.id).filter((x): x is string => Boolean(x));
  if (designIds.length) await db().from("designs").update({ approved_at: now }).in("id", designIds).is("approved_at", null);
  await logEvent({ orderId: order.id, actor: "customer", kind: "proof", msg: `Proof approved by customer; ${designIds.length} design(s) locked`, data: { designs: designIds } });

  if (!stripeConfigured()) {
    return json({ checkout_url: null, note: "Stripe not configured — approval recorded; Justin will send an invoice." });
  }
  const session = await createOrderCheckout({ orderId: order.id, orderNumber: order.number, amount: total, customerEmail: order.customer?.email, proofToken: token, description: `${(order.lines ?? []).length} line(s)` });
  await db().from("invoices").insert({ order_id: order.id, stripe_checkout_session_id: session.id, amount: total });
  await logEvent({ orderId: order.id, actor: "system", kind: "stripe", msg: `Checkout session created (${env.liveMoney() ? "LIVE" : "test"})`, data: { session: session.id } });
  return json({ checkout_url: session.url });
});
