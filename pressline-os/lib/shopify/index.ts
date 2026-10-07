import "server-only";
import { env } from "@/lib/env";
import { db } from "@/lib/supabase/service";

/**
 * deathcorps.shop (cae949-fc) over raw HTTP with X-Shopify-Access-Token
 * (rule 9: never n8n's built-in Shopify credential). Token from the
 * client-credentials exchange, ~24h life, auto-refreshed and stored in
 * pressline.integration_tokens so every instance + n8n share one token.
 */
const API_VERSION = "2025-07";
const PROVIDER = "shopify_dc";
const REFRESH_MARGIN_MS = 30 * 60 * 1000;

export function shopDomain(): string {
  const raw = env.shopifyDcShop().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return raw.includes(".") ? raw : `${raw}.myshopify.com`;
}

export async function mintToken(fetchImpl: typeof fetch = fetch): Promise<{ token: string; expiresAt: Date }> {
  const id = env.shopifyDcClientId(), secret = env.shopifyDcClientSecret();
  if (!id || !secret) throw new Error("SHOPIFY_DC_CLIENT_ID / SHOPIFY_DC_CLIENT_SECRET not set");
  const res = await fetchImpl(`https://${shopDomain()}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) throw new Error(`Shopify token exchange failed (${res.status}): ${json.error ?? ""}`);
  const expiresAt = new Date(Date.now() + (json.expires_in ?? 86399) * 1000);
  await db().from("integration_tokens").upsert({ provider: PROVIDER, access_token: json.access_token, expires_at: expiresAt.toISOString(), updated_at: new Date().toISOString() });
  return { token: json.access_token, expiresAt };
}

/** Current token, refreshed when within 30 min of expiry. */
export async function accessToken(): Promise<string> {
  const { data } = await db().from("integration_tokens").select("access_token, expires_at").eq("provider", PROVIDER).maybeSingle();
  if (data && new Date(data.expires_at).getTime() - REFRESH_MARGIN_MS > Date.now()) return data.access_token;
  return (await mintToken()).token;
}

export async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`https://${shopDomain()}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (!res.ok || json.errors?.length) throw new Error(`Shopify GraphQL: ${json.errors?.map((e) => e.message).join("; ") ?? res.status}`);
  return json.data as T;
}

export async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`https://${shopDomain()}/admin/api/${API_VERSION}/${path.replace(/^\//, "")}`, {
    ...init,
    headers: { "content-type": "application/json", "X-Shopify-Access-Token": token, ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Shopify ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

/** Publish one PRESSLINE product to deathcorps.shop. Returns the product GID. */
export async function publishProduct(input: {
  title: string; descriptionHtml?: string; price: number; sizes: string[]; imageUrls: string[]; tags?: string[]; vendor?: string;
}): Promise<{ gid: string; handle: string }> {
  type R = { productCreate: { product: { id: string; handle: string } | null; userErrors: Array<{ message: string }> } };
  const r = await graphql<R>(
    `mutation($input: ProductInput!, $media: [CreateMediaInput!]) {
      productCreate(input: $input, media: $media) { product { id handle } userErrors { message } }
    }`,
    {
      input: {
        title: input.title,
        descriptionHtml: input.descriptionHtml ?? "",
        vendor: input.vendor ?? "Death Corps",
        tags: input.tags ?? [],
        status: "ACTIVE",
        productOptions: [{ name: "Size", values: input.sizes.map((s) => ({ name: s })) }],
      },
      media: input.imageUrls.map((u) => ({ originalSource: u, mediaContentType: "IMAGE" })),
    },
  );
  if (!r.productCreate.product) throw new Error(r.productCreate.userErrors.map((e) => e.message).join("; ") || "productCreate failed");
  const gid = r.productCreate.product.id;
  // Price every variant.
  type V = { product: { variants: { nodes: Array<{ id: string }> } } };
  const v = await graphql<V>(`query($id: ID!) { product(id: $id) { variants(first: 50) { nodes { id } } } }`, { id: gid });
  await graphql(
    `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { message } }
    }`,
    { productId: gid, variants: v.product.variants.nodes.map((n) => ({ id: n.id, price: input.price.toFixed(2) })) },
  );
  return { gid, handle: r.productCreate.product.handle };
}
