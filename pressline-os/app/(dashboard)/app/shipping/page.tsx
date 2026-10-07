import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/supabase/service";
import type { ShipmentRow } from "@/lib/supabase/types";
import type { BoardOrder } from "@/components/board/types";
import { ShipPacked } from "@/components/board/ShipPacked";
import { Card, PageHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { fmtDateTime, trackingUrl } from "@/components/ui/format";

export const metadata: Metadata = { title: "Shipping" };
export const dynamic = "force-dynamic";

type PackedOrder = BoardOrder & { customer: { id: string; name: string | null; company: string | null; phone: string | null } | null };
type Ship = ShipmentRow & { order: { id: string; number: number } | null };

export default async function ShippingPage() {
  const [{ data: packed }, { data: shipments }] = await Promise.all([
    db().from("orders").select("*, customer:customers(id,name,company,phone), lines:order_lines(id)").eq("status", "PACKED").order("due_date", { ascending: true, nullsFirst: false })
      .overrideTypes<PackedOrder[], { merge: false }>(),
    db().from("shipments").select("*, order:orders(id, number)").order("shipped_at", { ascending: false }).limit(50).overrideTypes<Ship[], { merge: false }>(),
  ]);
  return (
    <>
      <PageHeader title="Shipping" subtitle="Packed orders get a label here. Buying the label moves the order to SHIPPED and emails the customer." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Packed · ${packed?.length ?? 0}`}><ShipPacked orders={packed ?? []} /></Card>
        <Card title="Recent shipments">
          {!shipments?.length ? <p className="text-sm text-mf-dim">No labels yet.</p> : (
            <ul className="divide-y divide-mf-line text-sm">
              {shipments.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{s.order ? <Link href={`/app/orders/${s.order.id}`} className="font-display text-lg no-underline">#{s.order.number}</Link> : "—"}<span className="ml-2 text-xs text-mf-muted">{s.carrier ?? ""}</span></span>
                  <span className="text-right">
                    {s.tracking ? <a href={trackingUrl(s.carrier, s.tracking)} target="_blank" rel="noreferrer" className="font-mono text-xs">{s.tracking}</a> : <span className="text-mf-dim">no tracking</span>}
                    <span className="block text-xs text-mf-dim">{fmtDateTime(s.shipped_at)} {s.delivered_at ? <Badge tone="ok" className="ml-1">delivered</Badge> : null}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
