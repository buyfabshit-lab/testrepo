import { bad, json, params, staffRoute } from "@/lib/api";
import { db } from "@/lib/supabase/service";
import { logEvent, newProofToken } from "@/lib/orders/service";
import { say } from "@/lib/outlaw";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ key: string }> };

/** Close a pop-up store: roll every PAID store order into ONE production order (Printavo Merch killer). */
export const POST = staffRoute<Ctx>(["owner"], async (_req, ctx, staff) => {
  const { key } = await params(ctx);
  const isUuid = /^[0-9a-f-]{36}$/.test(key);
  const { data: store } = await (isUuid ? db().from("stores").select("*").eq("id", key) : db().from("stores").select("*").eq("slug", key)).maybeSingle();
  if (!store) return bad("store not found", 404);
  if (store.closed_order_id) return bad("store already rolled up", 409, { order_id: store.closed_order_id });
  const { data: paid } = await db().from("store_orders").select("id, product_id, sizes, total, product:products(design_id, blank_id, price)").eq("store_id", store.id).not("paid_at", "is", null);
  if (!paid?.length) return bad("no paid store orders to roll up", 409);

  // Aggregate sizes per product.
  const byProduct = new Map<string, { design_id: string | null; blank_id: string | null; sizes: Record<string, number>; unit: number }>();
  for (const so of paid) {
    const g: { design_id: string | null; blank_id: string | null; sizes: Record<string, number>; unit: number } = byProduct.get(so.product_id ?? "") ?? { design_id: so.product?.design_id ?? null, blank_id: so.product?.blank_id ?? null, sizes: {}, unit: Number(so.product?.price ?? 0) };
    for (const [sz, n] of Object.entries((so.sizes as Record<string, number>) ?? {})) g.sizes[sz] = (g.sizes[sz] ?? 0) + Number(n || 0);
    byProduct.set(so.product_id ?? "", g);
  }
  const { data: order, error } = await db().from("orders").insert({ store_id: store.id, proof_token: newProofToken(), status: "PAID" }).select("id, number").single();
  if (error) throw new Error(error.message);
  await db().from("order_lines").insert(Array.from(byProduct.values()).map((g) => ({ order_id: order.id, blank_id: g.blank_id, design_id: g.design_id, sizes: g.sizes as never, locations: ["front"], unit_price: g.unit })));
  await db().from("stores").update({ closed_order_id: order.id, closes_at: new Date().toISOString() }).eq("id", store.id);
  const gross = paid.reduce((s, so) => s + Number(so.total ?? 0), 0);
  const fundraised = Math.round(gross * Number(store.fundraising_pct ?? 0)) / 100;
  await logEvent({ orderId: order.id, actor: staff.name ?? "owner", kind: "store_close", msg: `Store "${store.name}" closed → order #${order.number}: ${paid.length} orders, $${gross.toFixed(2)} gross, $${fundraised.toFixed(2)} fundraised`, data: { store_id: store.id, store_orders: paid.length } });
  await say(order.id, `${store.name} is closed. ${paid.length} orders rolled into ${order.number}. It's paid — it's real.`);
  return json({ order_id: order.id, order_number: order.number, store_orders: paid.length, gross, fundraised });
});
