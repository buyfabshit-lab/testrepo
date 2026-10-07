import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/** Skrew U store lives in its own Supabase project. Publish = insert a listing row. */
export function skrewuConfigured(): boolean {
  return Boolean(env.skrewuSupabaseUrl() && env.skrewuServiceKey());
}

export async function publishListing(input: { title: string; price: number; imageUrls: string[]; sizes: string[]; description?: string; tags?: string[] }): Promise<{ id: string }> {
  if (!skrewuConfigured()) throw new Error("SKREWU_SUPABASE_URL / SKREWU_SERVICE_KEY not set");
  const client = createClient(env.skrewuSupabaseUrl(), env.skrewuServiceKey(), { auth: { persistSession: false } });
  const { data, error } = await client
    .from("listings")
    .insert({ title: input.title, price: input.price, image_urls: input.imageUrls, sizes: input.sizes, description: input.description ?? "", tags: input.tags ?? [], is_live: true, source: "pressline" })
    .select("id")
    .single();
  if (error) throw new Error(`Skrew U publish: ${error.message}`);
  return { id: String((data as { id: string | number }).id) };
}
