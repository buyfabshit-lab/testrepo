import { bad, json, params, staffRoute } from "@/lib/api";
import { db } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { logEvent, newProofToken, transition } from "@/lib/orders/service";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Justin's one-tap approve (owner only). Quote → approved; order → APPROVED (creating it if needed). */
export const POST = staffRoute<Ctx>(["owner"], async (_req, ctx, staff) => {
  const { id } = await params(ctx);
  const { data: quote } = await db().from("quotes").select("*").eq("id", id).maybeSingle();
  if (!quote) return bad("quote not found", 404);
  const now = new Date().toISOString();
  await db().from("quotes").update({ status: "approved", approved_by: staff.userId, approved_at: now }).eq("id", id);

  let { data: order } = await db().from("orders").select("id, status, proof_token, number").eq("quote_id", id).maybeSingle();
  if (!order) {
    const { data: created, error } = await db().from("orders").insert({ quote_id: id, customer_id: quote.customer_id, proof_token: newProofToken(), status: "NEW" }).select("id, status, proof_token, number").single();
    if (error) throw new Error(error.message);
    const lines = (quote.lines as Array<{ blank_id?: string | null; sizes?: Record<string, number>; design_id?: string | null; locations?: string[]; unit?: number }>) ?? [];
    if (lines.length) await db().from("order_lines").insert(lines.map((l) => ({ order_id: created.id, blank_id: l.blank_id ?? null, sizes: (l.sizes ?? {}) as never, design_id: l.design_id ?? null, locations: l.locations ?? ["front"], unit_price: l.unit ?? null })));
    order = created;
  }
  if (order.status === "NEW") await transition(order.id, "QUOTED", { actor: "justin", reason: "approved from phone" });
  if (order.status !== "APPROVED") await transition(order.id, "APPROVED", { actor: "justin", reason: "one-tap approve" });
  await logEvent({ orderId: order.id, actor: "justin", kind: "approve", msg: `Quote approved by ${staff.name ?? "owner"}`, data: { quote_id: id } });
  const { data: fresh } = await db().from("orders").select("*").eq("id", order.id).single();
  return json({ order: fresh, proof_url: `${env.appUrl().replace(/\/+$/, "")}/proof/${order.proof_token}` });
});
