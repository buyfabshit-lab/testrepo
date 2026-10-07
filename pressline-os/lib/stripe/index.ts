import "server-only";
import Stripe from "stripe";
import { env, moneyIsLive } from "@/lib/env";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (client) return client;
  const key = env.stripeSecretKey();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (key.startsWith("sk_live_") && !moneyIsLive()) {
    throw new Error("Refusing to use a live Stripe key while LIVE_MONEY=false");
  }
  client = new Stripe(key);
  return client;
}

export function stripeConfigured(): boolean {
  return Boolean(env.stripeSecretKey());
}

/** Checkout Session for an order's proof page. Metadata carries the order id for the webhook. */
export async function createOrderCheckout(input: {
  orderId: string; orderNumber: number; amount: number; customerEmail?: string | null; description?: string; proofToken: string;
}) {
  const base = env.appUrl().replace(/\/+$/, "");
  return stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: input.customerEmail ?? undefined,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(input.amount * 100),
        product_data: { name: `Midnight Fusion order #${input.orderNumber}`, description: input.description ?? undefined },
      },
    }],
    metadata: { pressline_order_id: input.orderId, pressline_order_number: String(input.orderNumber) },
    success_url: `${base}/proof/${input.proofToken}?paid=1`,
    cancel_url: `${base}/proof/${input.proofToken}`,
  });
}

/** Stripe Invoice alternative (spec §7.1): send an invoice email instead of Checkout. */
export async function createOrderInvoice(input: {
  orderId: string; orderNumber: number; amount: number; customerEmail: string; customerName?: string | null; daysUntilDue?: number;
}) {
  const s = stripe();
  const customers = await s.customers.list({ email: input.customerEmail, limit: 1 });
  const customer = customers.data[0] ?? (await s.customers.create({ email: input.customerEmail, name: input.customerName ?? undefined }));
  const invoice = await s.invoices.create({
    customer: customer.id,
    collection_method: "send_invoice",
    days_until_due: input.daysUntilDue ?? 7,
    metadata: { pressline_order_id: input.orderId, pressline_order_number: String(input.orderNumber) },
  });
  await s.invoiceItems.create({
    customer: customer.id,
    invoice: invoice.id,
    amount: Math.round(input.amount * 100),
    currency: "usd",
    description: `Midnight Fusion order #${input.orderNumber}`,
  });
  const finalized = await s.invoices.finalizeInvoice(invoice.id);
  await s.invoices.sendInvoice(invoice.id);
  return finalized;
}

/** Pop-up store checkout. */
export async function createStoreCheckout(input: {
  storeSlug: string; storeOrderId: string; amount: number; title: string; customerEmail?: string | null;
}) {
  const base = env.appUrl().replace(/\/+$/, "");
  return stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: input.customerEmail ?? undefined,
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: Math.round(input.amount * 100), product_data: { name: input.title } } }],
    metadata: { pressline_store_order_id: input.storeOrderId, pressline_store_slug: input.storeSlug },
    success_url: `${base}/s/${input.storeSlug}?paid=1`,
    cancel_url: `${base}/s/${input.storeSlug}`,
  });
}

export function constructWebhookEvent(rawBody: string, signature: string) {
  return stripe().webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret());
}
