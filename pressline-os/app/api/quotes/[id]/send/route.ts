import { bad, json, params, staffRoute } from "@/lib/api";
import { db } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { logEvent, newProofToken, transition } from "@/lib/orders/service";
import { layout, sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Send quote → customer link. Creates the order (NEW → QUOTED) with a proof token. */
export const POST = staffRoute<Ctx>(undefined, async (_req, ctx, staff) => {
  const { id } = await params(ctx);
  const { data: quote } = await db().from("quotes").select("*, customer:customers(*)").eq("id", id).maybeSingle();
  if (!quote) return bad("quote not found", 404);

  const { data: existing } = await db().from("orders").select("id, proof_token, status").eq("quote_id", id).maybeSingle();
  let order = existing;
  if (!order) {
    const { data: created, error } = await db().from("orders").insert({ quote_id: id, customer_id: quote.customer_id, proof_token: newProofToken(), status: "NEW" }).select("id, proof_token, status, number").single();
    if (error) throw new Error(error.message);
    const lines = (quote.lines as Array<{ blank_id?: string | null; sizes?: Record<string, number>; design_id?: string | null; locations?: string[]; unit?: number }>) ?? [];
    if (lines.length) {
      await db().from("order_lines").insert(lines.map((l) => ({ order_id: created.id, blank_id: l.blank_id ?? null, sizes: (l.sizes ?? {}) as never, design_id: l.design_id ?? null, locations: l.locations ?? ["front"], unit_price: l.unit ?? null })));
    }
    await logEvent({ orderId: created.id, actor: staff.name ?? staff.role, kind: "order", msg: `Order #${created.number} created from quote`, data: { quote_id: id } });
    order = created;
  }
  if (order.status === "NEW") await transition(order.id, "QUOTED", { actor: staff.name ?? staff.role, reason: "quote sent" });
  await db().from("quotes").update({ status: "sent" }).eq("id", id);

  const proofUrl = `${env.appUrl().replace(/\/+$/, "")}/proof/${order.proof_token}`;
  const email = quote.customer?.email;
  if (email) {
    await sendEmail({
      to: email, subject: `Your Midnight Fusion quote — $${Number(quote.total ?? 0).toFixed(2)}`,
      html: layout("Your quote is ready", `<p>Here's the gear. Open the proof, check sizes, approve and pay when it's right.</p><p><a class="btn" href="${proofUrl}" style="color:#d4a94f;font-weight:700">Open your proof →</a></p>`),
      text: `Your Midnight Fusion quote: ${proofUrl}`,
    }).catch((e) => console.warn("[email]", e));
  }
  return json({ ok: true, order_id: order.id, proof_url: proofUrl });
});
