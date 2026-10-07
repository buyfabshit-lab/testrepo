import "server-only";
import { db } from "@/lib/supabase/service";
import { signedUrls } from "@/lib/supabase/storage";

export interface VaultQuery { q?: string; brand?: string; tags?: string[]; license?: string; limit?: number; offset?: number }

export async function search(input: VaultQuery) {
  let q = db().from("vault_assets").select("id, title, brand, tags, colors, dpi, license, thumb_url, storage_path, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(input.offset ?? 0, (input.offset ?? 0) + (input.limit ?? 60) - 1);
  if (input.q) q = q.ilike("title", `%${input.q}%`);
  if (input.brand) q = q.eq("brand", input.brand);
  if (input.license) q = q.eq("license", input.license as "mcg" | "customer" | "camo");
  if (input.tags?.length) q = q.overlaps("tags", input.tags);
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const thumbs = await signedUrls(rows.map((a) => a.thumb_url).filter((p): p is string => typeof p === "string" && !p.startsWith("http")), 3600).catch(() => ({} as Record<string, string>));
  return {
    total: count ?? 0,
    assets: rows.map((a) => ({ ...a, thumb: a.thumb_url ? (a.thumb_url.startsWith("http") ? a.thumb_url : thumbs[a.thumb_url] ?? null) : null })),
  };
}

/** Licensing gate (spec §7.5): MCG art only in approved contexts. */
export function licenseAllows(license: string | null, context: "customer_studio" | "house_product" | "wholesale"): boolean {
  if (license === "mcg") return context === "house_product";
  return true;
}
