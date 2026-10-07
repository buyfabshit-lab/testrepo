import type { Metadata } from "next";
import { db } from "@/lib/supabase/service";
import type { PriceRule } from "@/lib/pricing";
import { QuoteBuilder, type BuilderBlank, type BuilderCustomer } from "@/components/board/QuoteBuilder";
import { PageHeader } from "@/components/ui/Card";

export const metadata: Metadata = { title: "New quote" };
export const dynamic = "force-dynamic";

export default async function NewQuotePage() {
  const [{ data: customers }, { data: rules }, { data: blanks }] = await Promise.all([
    db().from("customers").select("id, name, company, email").order("name").limit(1000),
    db().from("price_rules").select("*"),
    db().from("blanks").select("id, supplier, style, brand, color, sizes, cost, photo_front, supplier_style_id").order("style").limit(500),
  ]);
  const priceRules: PriceRule[] = (rules ?? []).map((r) => ({
    method: r.method ?? "", qty_min: Number(r.qty_min ?? 0), qty_max: Number(r.qty_max ?? 0), base: Number(r.base ?? 0),
    per_location: Number(r.per_location ?? 0), per_color: Number(r.per_color ?? 0), setup_fee: Number(r.setup_fee ?? 0), margin_pct: Number(r.margin_pct ?? 0),
  }));
  return (
    <>
      <PageHeader title="New quote" subtitle="Pick the customer, add lines, watch the price. Save sends it to the quotes list." />
      <QuoteBuilder customers={(customers ?? []) as BuilderCustomer[]} rules={priceRules} blanks={(blanks ?? []) as BuilderBlank[]} />
    </>
  );
}
