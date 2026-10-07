import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase/service";
import type { CustomerRow, QuoteRow } from "@/lib/supabase/types";
import { Card, PageHeader } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { fmtDateTime, sizeKeys } from "@/components/ui/format";
import { lineTitle, quoteLines } from "@/components/board/quoteLines";
import { SendQuoteButton } from "@/components/board/SendQuoteButton";

export const metadata: Metadata = { title: "Quote" };
export const dynamic = "force-dynamic";

type Q = QuoteRow & { customer: CustomerRow | null };

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ data: quote }, { data: order }] = await Promise.all([
    db().from("quotes").select("*, customer:customers(*)").eq("id", id).maybeSingle().overrideTypes<Q, { merge: false }>(),
    db().from("orders").select("id, number, status, proof_token").eq("quote_id", id).maybeSingle(),
  ]);
  if (!quote) notFound();
  const lines = quoteLines(quote.lines);
  const c = quote.customer;

  return (
    <>
      <PageHeader title={`Quote ${quote.id.slice(0, 8)}`}
        subtitle={<span className="flex flex-wrap items-center gap-2"><Badge tone={quote.status === "approved" ? "ok" : quote.status === "sent" ? "gold" : "muted"}>{quote.status ?? "draft"}</Badge><span className="text-mf-dim">created {fmtDateTime(quote.created_at)}</span></span>}
        actions={<><Link href={`/app/quotes/${quote.id}/approve`} className="btn btn-solid">Approve view</Link><Link href="/app/quotes" className="btn">All quotes</Link></>} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Lines">
            {lines.length === 0 ? <p className="text-sm text-mf-dim">No lines.</p> : (
              <ul className="divide-y divide-mf-line">
                {lines.map((l, i) => {
                  const keys = sizeKeys(l.sizes);
                  return (
                    <li key={i} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                      <div>
                        <p className="font-bold">{lineTitle(l)}</p>
                        <p className="text-xs text-mf-muted">{(l.method ?? "").toUpperCase()} · {l.colors ?? 0} color{l.colors === 1 ? "" : "s"} · {(l.locations ?? []).join(", ")}</p>
                        <p className="mt-1 text-xs text-mf-muted">{keys.map((k) => `${k}:${l.sizes?.[k]}`).join("  ")}</p>
                      </div>
                      <div className="text-right">
                        <p>{l.qty ?? 0} × <Money value={l.unit} /></p>
                        {l.setup ? <p className="text-xs text-mf-muted">+ <Money value={l.setup} /> setup</p> : null}
                        <p className="font-bold text-mf-gold"><Money value={l.line} /></p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 flex items-end justify-between border-t border-mf-line pt-3"><span className="label !mb-0">Total</span><Money value={quote.total} className="font-display text-4xl text-mf-gold" /></p>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Customer">
            {c ? (<div className="text-sm"><Link href={`/app/customers/${c.id}`} className="font-bold">{c.name ?? "—"}</Link>{c.company ? <p className="text-mf-muted">{c.company}</p> : null}{c.email ? <p>{c.email}</p> : null}{c.phone ? <p>{c.phone}</p> : null}</div>) : <p className="text-sm text-mf-dim">No customer.</p>}
          </Card>
          <Card title="Send">
            <SendQuoteButton quoteId={quote.id} existingProofToken={order?.proof_token ?? null} />
          </Card>
          <Card title="Order">
            {order ? <p className="text-sm"><Link href={`/app/orders/${order.id}`} className="font-display text-xl">#{order.number}</Link> <StatusBadge status={order.status} className="ml-2" /></p> : <p className="text-sm text-mf-dim">No order yet. Sending or approving creates it.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
