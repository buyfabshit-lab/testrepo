import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Creates a Stripe Checkout Session for the DIME shop.
 *
 * SECURITY NOTE — the whole point of this function:
 * The browser sends only slugs and quantities. Every price is looked up again
 * from `dime_products` here, server-side, and the Session is built from those
 * values. A tampered cart cannot change what Stripe charges. Nothing the
 * client sends about money is trusted or even read.
 *
 * verify_jwt is off: this is a public endpoint by necessity (anonymous
 * shoppers, and the site's publishable key is not a JWT). That is safe
 * because the function exposes no data — it reads public catalogue rows and
 * returns a Stripe URL — and because it re-prices everything itself.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

type Line = { slug: string; qty: number };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    console.error("STRIPE_SECRET_KEY is not set");
    return json({ error: "payments are not configured yet" }, 503);
  }

  let payload: { items?: Line[]; fan_id?: string; handle?: string; note?: string; origin?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) return json({ error: "cart is empty" }, 400);
  if (items.length > 20) return json({ error: "too many line items" }, 400);

  // Normalise and de-duplicate before touching the database.
  const wanted = new Map<string, number>();
  for (const line of items) {
    if (typeof line?.slug !== "string") continue;
    const qty = Math.floor(Number(line?.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 99) continue;
    wanted.set(line.slug, Math.min(99, (wanted.get(line.slug) ?? 0) + qty));
  }
  if (!wanted.size) return json({ error: "nothing valid in the cart" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: products, error: lookupError } = await supabase
    .from("dime_products")
    .select("slug, name, description, price_cents, currency, image_url, stock, is_active")
    .in("slug", [...wanted.keys()]);

  if (lookupError) {
    console.error("product lookup failed", lookupError);
    return json({ error: "could not price the cart" }, 500);
  }

  const priced: { slug: string; name: string; qty: number; price_cents: number }[] = [];
  const lineItems: unknown[] = [];
  let currency = "usd";

  for (const [slug, qty] of wanted) {
    const p = products?.find((row) => row.slug === slug);
    if (!p || !p.is_active) return json({ error: `"${slug}" is no longer available` }, 409);
    if (p.stock !== null && p.stock < qty) {
      return json({ error: `only ${p.stock} of "${p.name}" left` }, 409);
    }

    currency = (p.currency ?? "USD").toLowerCase();
    priced.push({ slug, name: p.name, qty, price_cents: p.price_cents });
    lineItems.push({
      quantity: qty,
      price_data: {
        currency,
        unit_amount: p.price_cents, // from the database, never from the client
        product_data: {
          name: p.name,
          ...(p.description ? { description: p.description } : {}),
          ...(p.image_url?.startsWith("http") ? { images: [p.image_url] } : {}),
        },
      },
    });
  }

  const subtotal = priced.reduce((sum, l) => sum + l.price_cents * l.qty, 0);

  // Only allow returning to an origin we recognise, so this cannot be used to
  // bounce shoppers to an attacker's page.
  const allowed = (Deno.env.get("DIME_SITE_ORIGINS") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const requested = typeof payload.origin === "string" ? payload.origin : "";
  const origin = allowed.includes(requested) ? requested : allowed[0];
  if (!origin) {
    console.error("DIME_SITE_ORIGINS is not set");
    return json({ error: "payments are not configured yet" }, 503);
  }

  // Stripe's API is form-encoded; build the body without pulling in the SDK.
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", `${origin}/?checkout=success&session={CHECKOUT_SESSION_ID}`);
  form.set("cancel_url", `${origin}/?checkout=cancelled`);
  form.set("billing_address_collection", "auto");
  form.set("phone_number_collection[enabled]", "false");
  // Physical merch, so Stripe collects the shipping address for us.
  form.set("shipping_address_collection[allowed_countries][0]", "US");
  form.set("shipping_address_collection[allowed_countries][1]", "CA");
  form.set("shipping_address_collection[allowed_countries][2]", "GB");
  form.set("metadata[fan_id]", String(payload.fan_id ?? "").slice(0, 64));
  form.set("metadata[handle]", String(payload.handle ?? "").slice(0, 24));
  form.set("metadata[note]", String(payload.note ?? "").slice(0, 480));

  lineItems.forEach((li, i) => {
    const item = li as Record<string, any>;
    form.set(`line_items[${i}][quantity]`, String(item.quantity));
    form.set(`line_items[${i}][price_data][currency]`, item.price_data.currency);
    form.set(`line_items[${i}][price_data][unit_amount]`, String(item.price_data.unit_amount));
    form.set(`line_items[${i}][price_data][product_data][name]`, item.price_data.product_data.name);
    if (item.price_data.product_data.description) {
      form.set(
        `line_items[${i}][price_data][product_data][description]`,
        item.price_data.product_data.description,
      );
    }
    if (item.price_data.product_data.images) {
      form.set(
        `line_items[${i}][price_data][product_data][images][0]`,
        item.price_data.product_data.images[0],
      );
    }
  });

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  const session = await stripeRes.json();
  if (!stripeRes.ok) {
    console.error("stripe session creation failed", session?.error?.message);
    return json({ error: "could not start checkout" }, 502);
  }

  // Record the intent now so an order exists even if the shopper abandons the
  // page. The webhook is what later flips it to paid.
  const { error: insertError } = await supabase.from("dime_orders").insert({
    fan_id: payload.fan_id ?? null,
    handle: String(payload.handle ?? "").slice(0, 24) || null,
    email: session.customer_details?.email ?? "pending@checkout.stripe",
    items: priced,
    subtotal_cents: subtotal,
    currency: currency.toUpperCase(),
    note: String(payload.note ?? "").slice(0, 500) || null,
    status: "pending",
    stripe_session_id: session.id,
  });

  if (insertError) {
    // The Session exists at Stripe but we failed to record it. Refuse rather
    // than send someone to pay for an order we have no row for.
    console.error("order insert failed", insertError);
    return json({ error: "could not start checkout" }, 500);
  }

  return json({ url: session.url, session_id: session.id });
});
