import "server-only";
import { db } from "@/lib/supabase/service";
import { signedUrls } from "@/lib/supabase/storage";

export interface VaultQuery { q?: string; brand?: string; tags?: string[]; license?: string; limit?: number; offset?: number; context?: "customer_studio" | "house_product" | "wholesale"; withUrls?: boolean }

export async function search(input: VaultQuery) {
  let q = db().from("vault_assets").select("id, title, brand, tags, colors, dpi, license, thumb_url, storage_path, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(input.offset ?? 0, (input.offset ?? 0) + (input.limit ?? 60) - 1);
  if (input.q) q = q.ilike("title", `%${input.q}%`);
  if (input.brand) q = q.eq("brand", input.brand);
  if (input.license) q = q.eq("license", input.license as "mcg" | "customer" | "camo");
  if (input.tags?.length) q = q.overlaps("tags", input.tags);
  // Customers never see MCG-licensed art (spec §7.5).
  if (input.context === "customer_studio") q = q.neq("license", "mcg");
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const thumbs = await signedUrls(rows.map((a) => a.thumb_url).filter((p): p is string => typeof p === "string" && !p.startsWith("http")), 3600).catch(() => ({} as Record<string, string>));
  const fulls = input.withUrls ? await signedUrls(rows.map((a) => a.storage_path).filter((p) => !p.startsWith("http")), 3600).catch(() => ({} as Record<string, string>)) : {};
  return {
    total: count ?? 0,
    assets: rows.map((a) => ({
      ...a,
      storage_path: input.context === "customer_studio" ? undefined : a.storage_path,
      thumb: a.thumb_url ? (a.thumb_url.startsWith("http") ? a.thumb_url : thumbs[a.thumb_url] ?? null) : null,
      url: input.withUrls ? (a.storage_path.startsWith("http") ? a.storage_path : fulls[a.storage_path] ?? null) : undefined,
    })),
  };
}

/** Licensing gate (spec §7.5): MCG art only in approved contexts. */
export function licenseAllows(license: string | null, context: "customer_studio" | "house_product" | "wholesale"): boolean {
  if (license === "mcg") return context === "house_product";
  return true;
}
