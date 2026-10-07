import { createHmac, timingSafeEqual } from "node:crypto";
import { bad, json, route } from "@/lib/api";
import { env } from "@/lib/env";
import { db } from "@/lib/supabase/service";
import { logEvent, newProofToken } from "@/lib/orders/service";
import { say } from "@/lib/outlaw";
export const dynamic = "force-dynamic";

/** deathcorps.shop orders/create → mirror as a PAID order on store death-corps. HMAC with the app client secret. */
export const POST = route(async (req) => {
  const raw = await req.text();
  const given = req.headers.get("x-shopify-hmac-sha256") ?? "";
  const want = createHmac("sha256", env.shopifyDcClientSecret()).update(raw).digest("base64");
  const a = Buffer.from(want), b = Buffer.from(given);
  if (!env.shopifyDcClientSecret() || a.length !== b.length || !timingSafeEqual(a, b)) return bad("bad hmac", 401);
  const topic = req.headers.get("x-shopify-topic") ?? "";
  if (topic !== "orders/create") return json({ ignored: topic });
  const o = JSON.parse(raw) as {
    id: number; name: string; email?: string; customer?: { first_name?: string; last_name?: string };
    shipping_address?: { name?: string; company?: string | null; address1?: string; address2?: string | null; city?: string; province_code?: string; zip?: string; country_code?: string; phone?: string | null } | null;
    line_items: Array<{ title: string; sku?: string; quantity: number; variant_title?: string; price: string }>; total_price: string;
  };
  const sa = o.shipping_address;
  const address = sa ? { name: sa.name ?? "", company: sa.company ?? null, street1: sa.address1 ?? "", street2: sa.address2 ?? null, city: sa.city ?? "", state: sa.province_code ?? "", postalCode: sa.zip ?? "", country: sa.country_code ?? "US", phone: sa.phone ?? null } : null;
  const { data: store } = await db().from("stores").select("id").eq("slug", "death-corps").maybeSingle();
  const email = o.email?.toLowerCase();
  let customerId: string | null = null;
  if (email) {
    const { data: c } = await db().from("customers").select("id").ilike("email", email).maybeSingle();
    customerId = c?.id ?? (await db().from("customers").insert({ email, name: [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(" ") || null, source: "checkout", brand_affinity: ["death_corps"], address: address as never }).select("id").single()).data?.id ?? null;
    if (c?.id && address) await db().from("customers").update({ address: address as never }).eq("id", c.id);
  }
  const { data: order, error } = await db().from("orders").insert({ customer_id: customerId, store_id: store?.id ?? null, proof_token: newProofToken(), status: "PAID" }).select("id, number").single();
  if (error) throw new Error(error.message);
  await db().from("order_lines").insert(o.line_items.map((li) => ({ order_id: order.id, sizes: { [li.variant_title ?? "OS"]: li.quantity } as never, locations: ["front"], unit_price: Number(li.price) })));
  await logEvent({ orderId: order.id, actor: "system", kind: "shopify", msg: `Shopify ${o.name} mirrored as #${order.number} ($${o.total_price})`, data: { shopify_id: o.id } });
  await say(order.id, `→ jeff: ${order.number} came in off deathcorps.shop (${o.name}). ${o.line_items.length} line${o.line_items.length === 1 ? "" : "s"}.`, { to: "jeff" });
  return json({ ok: true, order_id: order.id, number: order.number });
});
