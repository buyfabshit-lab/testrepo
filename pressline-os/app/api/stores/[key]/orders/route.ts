import { z } from "zod";
import { bad, clientIp, json, params, parse, rateLimit, route } from "@/lib/api";
import { db } from "@/lib/supabase/service";
import { createStoreCheckout, stripeConfigured } from "@/lib/stripe";
import { sumSizes } from "@/lib/pricing";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ key: string }> };
const Body = z.object({ product_id: z.string().uuid(), sizes: z.record(z.string(), z.number().int().nonnegative()), name: z.string().min(1).max(120), email: z.string().email() });

/** Pop-up store order → Stripe Checkout. Store must be open. */
export const POST = route<Ctx>(async (req, ctx) => {
  if (!rateLimit(`store:${clientIp(req)}`, 20, 60_000)) return bad("slow down", 429);
  const { key } = await params(ctx);
  const b = await parse(req, Body);
  const { data: store } = await db().from("stores").select("*").or(`slug.eq.${key},id.eq.${/^[0-9a-f-]{36}$/.test(key) ? key : "00000000-0000-0000-0000-000000000000"}`).maybeSingle();
  if (!store) return bad("store not found", 404);
  const now = Date.now();
  if (store.opens_at && new Date(store.opens_at).getTime() > now) return bad("store not open yet", 409);
  if (store.closes_at && new Date(store.closes_at).getTime() < now) return bad("store is closed", 409);
  const { data: product } = await db().from("products").select("id, title, price").eq("id", b.product_id).eq("store_id", store.id).maybeSingle();
  if (!product) return bad("product not in this store", 404);
  const qty = sumSizes(b.sizes);
  if (qty < 1) return bad("pick at least one size", 422);
  const total = Math.round(Number(product.price ?? 0) * qty * 100) / 100;
  const email = b.email.toLowerCase();
  const { data: c } = await db().from("customers").select("id").ilike("email", email).maybeSingle();
  const customerId = c?.id ?? (await db().from("customers").insert({ email, name: b.name, source: "checkout" }).select("id").single()).data?.id ?? null;
  const { data: so, error } = await db().from("store_orders").insert({ store_id: store.id, customer_id: customerId, product_id: product.id, sizes: b.sizes as never, total }).select("id").single();
  if (error) throw new Error(error.message);
  if (!stripeConfigured()) return json({ checkout_url: null, store_order_id: so.id, note: "Stripe not configured" });
  const session = await createStoreCheckout({ storeSlug: store.slug ?? key, storeOrderId: so.id, amount: total, title: `${product.title} × ${qty}`, customerEmail: email });
  await db().from("store_orders").update({ stripe_checkout_session_id: session.id }).eq("id", so.id);
  return json({ checkout_url: session.url, store_order_id: so.id });
});
