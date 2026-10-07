import type { Metadata } from "next";
import { db } from "@/lib/supabase/service";
import type { PurchaseOrderRow } from "@/lib/supabase/types";
import { Suppliers } from "@/components/board/Suppliers";
import { PageHeader } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Suppliers" };
export const dynamic = "force-dynamic";

export type PendingPo = PurchaseOrderRow & { order: { id: string; number: number } | null };

export default async function SuppliersPage() {
  const liveMoney = /^(1|true|yes|on)$/i.test(process.env.LIVE_MONEY ?? "");
  const { data: pos } = await db().from("purchase_orders").select("*, order:orders(id, number)").order("created_at", { ascending: false }).limit(50)
    .overrideTypes<PendingPo[], { merge: false }>();
  return (
    <>
      <PageHeader title="Suppliers" subtitle="S&S live catalog, SanMar EPDD, the contract crew, and purchase orders waiting on a signature." />
      <div className={`mb-4 border px-4 py-2 text-sm ${liveMoney ? "border-mf-blood bg-mf-blood/20 text-mf-cream" : "border-mf-line text-mf-muted"}`}>
        <span className="font-bold uppercase tracking-widest">{liveMoney ? "LIVE MONEY ON" : "Dry run"}</span>
        <span className="ml-2">{liveMoney ? "— approving a PO places it with the supplier for real." : "— LIVE_MONEY is off; approving a PO returns a dry-run payload and spends nothing."}</span>
      </div>
      <Suppliers pos={pos ?? []} liveMoney={liveMoney} />
    </>
  );
}
