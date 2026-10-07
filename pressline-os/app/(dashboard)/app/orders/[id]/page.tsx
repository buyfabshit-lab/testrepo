import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase/service";
import type { BlankRow, CustomerRow, DesignRow, EventRow, InvoiceRow, OrderLineRow, OrderRow, PurchaseOrderRow, ShipmentRow } from "@/lib/supabase/types";
import type { OrderStatus } from "@/lib/orders/status";
import { OrderActions, type PoLine } from "@/components/board/OrderActions";
import { Card, PageHeader } from "@/components/ui/Card";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { fmtDateTime, fmtDay, isOverdue, sizeKeys, sumSizes, trackingUrl } from "@/components/ui/format";

export const metadata: Metadata = { title: "Order" };
export const dynamic = "force-dynamic";

type Line = OrderLineRow & { blank: BlankRow | null; design: Pick<DesignRow, "id" | "file_name" | "method" | "approved_at"> | null };
type Full = OrderRow & { customer: CustomerRow | null; lines: Line[] | null; invoices: InvoiceRow[] | null; shipments: ShipmentRow[] | null; purchase_orders: PurchaseOrderRow[] | null };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ data: order }, { data: events }] = await Promise.all([
    db().from("orders")
      .select("*, customer:customers(*), lines:order_lines(*, blank:blanks(*), design:designs(id,file_name,method,approved_at)), invoices(*), shipments(*), purchase_orders(*)")
      .eq("id", id).maybeSingle().overrideTypes<Full, { merge: false }>(),
    db().from("events").select("*").eq("order_id", id).order("ts", { ascending: false }).limit(200),
  ]);
  if (!order) notFound();

  const lines = order.lines ?? [];
  const allSizes = sizeKeys(Object.assign({}, ...lines.map((l) => (l.sizes ?? {}) as Record<string, unknown>)));
  const totalQty = lines.reduce((s, l) => s + sumSizes(l.sizes), 0);
  const estTotal = lines.reduce((s, l) => s + sumSizes(l.sizes) * Number(l.unit_price ?? 0), 0);
  const poLines: PoLine[] = lines
    .filter((l) => l.blank?.supplier_style_id || l.blank?.style)
    .map((l) => ({ identifier: String(l.blank?.supplier_style_id ?? l.blank?.style), qty: sumSizes(l.sizes) }));
  const overdue = isOverdue(order.due_date, order.status);
  const c = order.customer;

  return (
    <>
      <PageHeader
        title={<>#{order.number}</>}
        subtitle={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={order.status} />{order.rush ? <Badge tone="blood">Rush</Badge> : null}<span className={overdue ? "font-bold text-red-500" : ""}>Due {fmtDay(order.due_date, true)}{overdue ? " · overdue" : ""}</span><span className="text-mf-dim">· created {fmtDateTime(order.created_at)}</span></span>}
        actions={<Link href="/app/board" className="btn">Board</Link>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Actions">
            <OrderActions orderId={order.id} orderNumber={order.number} status={(order.status ?? "NEW") as OrderStatus} proofToken={order.proof_token}
              customer={c ? { name: c.name, company: c.company, phone: c.phone, address: (c.address as Partial<import("@/components/board/LabelForm").ShipTo> | null) ?? null } : null} poLines={poLines} hasPo={(order.purchase_orders?.length ?? 0) > 0} />
          </Card>

          <Card title={`Lines · ${totalQty} pcs`} action={<span className="text-sm text-mf-muted">est. <Money value={estTotal} className="text-mf-gold" /></span>}>
            {lines.length === 0 ? <p className="text-sm text-mf-dim">No lines.</p> : (
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-[520px] text-sm">
                  <thead><tr className="border-b border-mf-line text-left text-[.65rem] uppercase tracking-[.15em] text-mf-dim">
                    <th className="px-2 py-1.5">Blank</th>
                    {allSizes.map((s) => <th key={s} className="px-2 py-1.5 text-center">{s}</th>)}
                    <th className="px-2 py-1.5 text-right">Qty</th><th className="px-2 py-1.5 text-right">Unit</th><th className="px-2 py-1.5">Design</th>
                  </tr></thead>
                  <tbody>
                    {lines.map((l) => {
                      const sizes = (l.sizes ?? {}) as Record<string, number>;
                      return (
                        <tr key={l.id} className="border-b border-mf-line/60 align-top">
                          <td className="px-2 py-2">
                            <p className="font-bold">{l.blank ? `${l.blank.brand ?? ""} ${l.blank.style ?? ""}`.trim() : "—"}</p>
                            <p className="text-xs text-mf-muted">{l.blank?.color ?? ""}{l.locations?.length ? ` · ${l.locations.join(", ")}` : ""}</p>
                          </td>
                          {allSizes.map((s) => <td key={s} className="px-2 py-2 text-center tabular-nums">{sizes[s] ?? sizes[s.toLowerCase()] ?? ""}</td>)}
                          <td className="px-2 py-2 text-right tabular-nums">{sumSizes(l.sizes)}</td>
                          <td className="px-2 py-2 text-right"><Money value={l.unit_price} /></td>
                          <td className="px-2 py-2 text-xs">
                            {l.design ? (<><span className="font-mono">{l.design.file_name ?? l.design.id.slice(0, 8)}</span>{l.design.approved_at ? <Badge tone="ok" className="ml-1">approved</Badge> : null}</>) : <span className="text-mf-dim">no design</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Timeline">
            {!events?.length ? <p className="text-sm text-mf-dim">No events yet.</p> : (
              <ol className="space-y-2 text-sm">
                {(events as EventRow[]).map((e) => (
                  <li key={e.id} className="flex gap-3 border-b border-mf-line/50 pb-2">
                    <span className="w-24 shrink-0 text-xs text-mf-dim">{fmtDateTime(e.ts)}</span>
                    <div className="min-w-0">
                      <p><span className="mr-2 text-[.6rem] uppercase tracking-widest text-mf-gold">{e.actor ?? "system"} · {e.kind ?? ""}</span>{e.msg}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Customer">
            {c ? (
              <div className="text-sm">
                <Link href={`/app/customers/${c.id}`} className="font-bold">{c.name ?? "—"}</Link>
                {c.company ? <p className="text-mf-muted">{c.company}</p> : null}
                {c.email ? <p><a href={`mailto:${c.email}`}>{c.email}</a></p> : null}
                {c.phone ? <p><a href={`tel:${c.phone}`}>{c.phone}</a></p> : null}
                <p className="mt-2 flex flex-wrap gap-1">{c.vip ? <Badge tone="gold">VIP</Badge> : null}{c.source ? <Badge>{c.source}</Badge> : null}{c.niche ? <Badge>{c.niche}</Badge> : null}</p>
              </div>
            ) : <p className="text-sm text-mf-dim">No customer attached.</p>}
          </Card>

          <Card title="Invoices">
            {!order.invoices?.length ? <p className="text-sm text-mf-dim">None.</p> : (
              <ul className="space-y-1 text-sm">
                {order.invoices.map((i) => (
                  <li key={i.id} className="flex justify-between"><span><Money value={i.amount} /></span>{i.paid_at ? <Badge tone="ok">paid {fmtDay(i.paid_at.slice(0, 10))}</Badge> : <Badge tone="warn">unpaid</Badge>}</li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Purchase orders">
            {!order.purchase_orders?.length ? <p className="text-sm text-mf-dim">None.</p> : (
              <ul className="space-y-1 text-sm">
                {order.purchase_orders.map((p) => (
                  <li key={p.id} className="flex justify-between"><span>{p.supplier ?? "—"} {p.supplier_po ? <span className="font-mono text-xs">{p.supplier_po}</span> : null}</span><Badge tone={p.status === "placed" ? "ok" : "warn"}>{p.status ?? "?"}</Badge></li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Shipments">
            {!order.shipments?.length ? <p className="text-sm text-mf-dim">None.</p> : (
              <ul className="space-y-2 text-sm">
                {order.shipments.map((s) => (
                  <li key={s.id}>
                    <p>{s.carrier ?? "carrier?"} · {s.tracking ? <a href={trackingUrl(s.carrier, s.tracking)} target="_blank" rel="noreferrer" className="font-mono">{s.tracking}</a> : "no tracking"}</p>
                    <p className="text-xs text-mf-dim">shipped {fmtDateTime(s.shipped_at)}{s.delivered_at ? ` · delivered ${fmtDateTime(s.delivered_at)}` : ""}{s.label_url ? <> · <a href={s.label_url} target="_blank" rel="noreferrer">label</a></> : null}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
