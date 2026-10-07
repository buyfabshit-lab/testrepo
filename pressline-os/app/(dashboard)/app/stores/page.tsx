import type { Metadata } from "next";
import { db } from "@/lib/supabase/service";
import { currentStaff } from "@/lib/auth/staff";
import type { ProductRow, StoreRow } from "@/lib/supabase/types";
import { StoreCard, NewStoreForm } from "@/components/board/Stores";
import { PageHeader } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Stores" };
export const dynamic = "force-dynamic";

export type StoreWithProducts = StoreRow & { products: (ProductRow & { blank: { style: string | null; brand: string | null; color: string | null } | null })[] | null };

export default async function StoresPage() {
  const staff = await currentStaff();
  const { data: stores, error } = await db().from("stores").select("*, products(*, blank:blanks(style, brand, color))").order("created_at", { ascending: false })
    .overrideTypes<StoreWithProducts[], { merge: false }>();
  const { data: paidCounts } = await db().from("store_orders").select("store_id, paid_at").not("paid_at", "is", null);
  const paidByStore = new Map<string, number>();
  for (const so of paidCounts ?? []) if (so.store_id) paidByStore.set(so.store_id, (paidByStore.get(so.store_id) ?? 0) + 1);
  const isOwner = staff?.role === "owner";

  return (
    <>
      <PageHeader title="Stores" subtitle={error ? error.message : "Shopify, Stripe, SKREWU, pop-ups and wholesale. Publish a product everywhere from one row."} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {!stores?.length ? <p className="panel p-8 text-center text-sm text-mf-dim">No stores yet.</p> : null}
          {stores?.map((s) => <StoreCard key={s.id} store={s} paidOrders={paidByStore.get(s.id) ?? 0} isOwner={isOwner} />)}
        </div>
        <div>{isOwner ? <NewStoreForm /> : <p className="panel p-4 text-sm text-mf-dim">Only the owner can open a pop-up store.</p>}</div>
      </div>
    </>
  );
}
