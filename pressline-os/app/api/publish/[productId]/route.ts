import { z } from "zod";
import { bad, json, params, parse, staffRoute } from "@/lib/api";
import { db } from "@/lib/supabase/service";
import { signedUrls } from "@/lib/supabase/storage";
import { publishProduct as shopifyPublish } from "@/lib/shopify";
import { publishListing as skrewuPublish } from "@/lib/skrewu";
import { logEvent } from "@/lib/orders/service";
import { postToN8n } from "@/lib/n8n/sign";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ productId: string }> };
const Body = z.object({ targets: z.array(z.enum(["shopify", "skrewu", "stripe", "wholesale"])).min(1) });

/** One product → Publish per target (spec §7.9). Owner only. */
export const POST = staffRoute<Ctx>(["owner"], async (req, ctx, staff) => {
  const { productId } = await params(ctx);
  const b = await parse(req, Body);
  const { data: product } = await db().from("products").select("*, design:designs(file_name, print_file_path), blank:blanks(style, brand, color, sizes)").eq("id", productId).maybeSingle();
  if (!product) return bad("product not found", 404);
  const published = ((product.published as Record<string, string>) ?? {});
  const mockups = product.mockups ?? [];
  const imageUrls = mockups.filter((m) => m.startsWith("http"));
  const signed = await signedUrls(mockups.filter((m) => !m.startsWith("http")), 7 * 24 * 3600).catch(() => ({} as Record<string, string>));
  imageUrls.push(...Object.values(signed));
  const sizes = product.blank?.sizes ?? ["S", "M", "L", "XL", "2XL"];
  const results: Record<string, { ok: boolean; id?: string; error?: string }> = {};

  for (const t of b.targets) {
    try {
      if (t === "shopify") {
        const r = await shopifyPublish({ title: product.title ?? "Untitled", price: Number(product.price ?? 0), sizes, imageUrls, tags: ["pressline"] });
        published.shopify = r.gid; results.shopify = { ok: true, id: r.gid };
      } else if (t === "skrewu") {
        const r = await skrewuPublish({ title: product.title ?? "Untitled", price: Number(product.price ?? 0), sizes, imageUrls });
        published.skrewu = r.id; results.skrewu = { ok: true, id: r.id };
      } else if (t === "stripe") {
        // Death Squad store = Stripe Checkout off our own /s/death-squad page; "publishing" = attach to the store.
        const { data: store } = await db().from("stores").select("id").eq("slug", "death-squad").maybeSingle();
        if (store) await db().from("products").update({ store_id: store.id }).eq("id", productId);
        published.stripe = "death-squad"; results.stripe = { ok: true, id: "death-squad" };
      } else if (t === "wholesale") {
        published.wholesale = "catalog"; results.wholesale = { ok: true, id: "catalog" };
      }
    } catch (e) {
      results[t] = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  await db().from("products").update({ published: published as never }).eq("id", productId);
  await logEvent({ actor: staff.name ?? "owner", kind: "publish", msg: `Published "${product.title}" → ${b.targets.join(", ")}`, data: { product_id: productId, results } });
  if (Object.values(results).some((r) => r.ok)) void postToN8n("pressline/published", { product_id: productId, title: product.title, price: product.price, mockups: imageUrls, published });
  return json({ published, results });
});
