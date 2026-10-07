import { json, route } from "@/lib/api";
import { db } from "@/lib/supabase/service";
import { productsByStyle, searchStyles, ssConfigured } from "@/lib/ss";
export const dynamic = "force-dynamic";

/** Live catalog: S&S when configured, otherwise cached `blanks` rows. Public read (studio uses it); no costs exposed to anon. */
export const GET = route(async (req) => {
  const p = new URL(req.url).searchParams;
  const supplier = p.get("supplier") ?? "ss", style = p.get("style") ?? "", color = p.get("color") ?? "";
  if (supplier === "ss" && ssConfigured() && style) {
    const styles = await searchStyles({ styleName: style });
    const s = styles[0];
    if (!s) return json({ source: "ss", blanks: [] });
    const products = await productsByStyle(s.styleID);
    const byColor = new Map<string, { color: string; sizes: string[]; qty: number; price: number; photo_front: string | null; photo_back: string | null }>();
    const abs = (u?: string) => (u ? (u.startsWith("http") ? u : `https://cdn.ssactivewear.com/${u}`) : null);
    for (const pr of products) {
      if (color && pr.colorName.toLowerCase() !== color.toLowerCase()) continue;
      const g = byColor.get(pr.colorName) ?? { color: pr.colorName, sizes: [], qty: 0, price: pr.customerPrice, photo_front: abs(pr.colorFrontImage), photo_back: abs(pr.colorBackImage) };
      g.sizes.push(pr.sizeName); g.qty += pr.qty ?? 0; byColor.set(pr.colorName, g);
    }
    return json({ source: "ss", style: { id: s.styleID, brand: s.brandName, name: s.styleName, title: s.title }, blanks: Array.from(byColor.values()) });
  }
  let q = db().from("blanks").select("id, supplier, style, brand, color, sizes, photo_front, photo_back").order("style");
  if (supplier) q = q.eq("supplier", supplier as "ss" | "sanmar" | "unity" | "other");
  if (style) q = q.ilike("style", `%${style}%`);
  if (color) q = q.ilike("color", `%${color}%`);
  const { data } = await q.limit(100);
  return json({ source: "cache", blanks: data ?? [] });
});
