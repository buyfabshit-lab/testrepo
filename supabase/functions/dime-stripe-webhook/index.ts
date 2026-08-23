import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Stripe webhook for the DIME shop. Flips an order from pending to paid.
 *
 * verify_jwt is off because Stripe does not send a Supabase JWT. Authenticity
 * comes from the Stripe signature instead, checked below against
 * STRIPE_WEBHOOK_SECRET. An unsigned or mis-signed request is rejected before
 * the body is parsed, so this endpoint being public is not a way in.
 */

const encoder = new TextEncoder();

/** Constant-time compare, so a wrong signature leaks nothing by timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verifies Stripe's `Stripe-Signature` header.
 * Implemented directly rather than via the SDK: it is ~20 lines of WebCrypto
 * and avoids pulling a Node-targeted library into the edge runtime.
 */
async function verify(body: string, header: string, secret: string, toleranceSec = 300) {
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=", 2) as [string, string]),
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  // Reject replays of an old, validly-signed body.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSec) return false;

  return safeEqual(await hmacHex(secret, `${timestamp}.${body}`), signature);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return new Response("not configured", { status: 503 });
  }

  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();
  if (!signature || !(await verify(body, signature, secret))) {
    return new Response("bad signature", { status: 400 });
  }

  const event = JSON.parse(body);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Idempotency: claim the event id first. A duplicate delivery loses the
  // insert on the primary key and returns 200 without touching the order.
  const { error: claimError } = await supabase
    .from("dime_stripe_events")
    .insert({ id: event.id, type: event.type });

  if (claimError) {
    if (claimError.code === "23505") {
      return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
    }
    // Anything else is a real failure: 500 so Stripe retries.
    console.error("could not record event", claimError);
    return new Response("error", { status: 500 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const { error: updateError } = await supabase
      .from("dime_orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        email: session.customer_details?.email ?? undefined,
        amount_total_cents: session.amount_total ?? null,
        stripe_payment_intent: session.payment_intent ?? null,
        shipping: session.collected_information?.shipping_details ??
          session.shipping_details ?? null,
      })
      .eq("stripe_session_id", session.id);

    if (updateError) {
      console.error("could not mark order paid", updateError);
      // Release the claim so Stripe's retry can try again rather than being
      // swallowed as a duplicate.
      await supabase.from("dime_stripe_events").delete().eq("id", event.id);
      return new Response("error", { status: 500 });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
