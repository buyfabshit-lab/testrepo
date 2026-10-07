import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase/service";
import type { TouchRow } from "@/lib/supabase/types";
import { BOARD_SELECT, type BoardOrder } from "@/components/board/types";
import { Card, PageHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Badge, SmsConsent, StatusBadge, YesNo } from "@/components/ui/Badge";
import { fmtDateTime, fmtDay, isOverdue } from "@/components/ui/format";

export const metadata: Metadata = { title: "Customer" };
export const dynamic = "force-dynamic";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ data: c }, { data: orders }, { data: touches }] = await Promise.all([
    db().from("customers").select("*").eq("id", id).maybeSingle(),
    db().from("orders").select(BOARD_SELECT).eq("customer_id", id).order("created_at", { ascending: false }).limit(100).overrideTypes<BoardOrder[], { merge: false }>(),
    db().from("touches").select("*, campaign:campaigns(name, channel)").eq("customer_id", id).order("sent_at", { ascending: false }).limit(100)
      .overrideTypes<(TouchRow & { campaign: { name: string | null; channel: string | null } | null })[], { merge: false }>(),
  ]);
  if (!c) notFound();

  return (
    <>
      <PageHeader title={c.name ?? c.company ?? "Customer"} subtitle={c.company && c.name ? c.company : undefined}
        actions={<><Link href="/app/quotes/new" className="btn btn-solid">New quote</Link><Link href="/app/customers" className="btn">All customers</Link></>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Profile">
          <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
            <dt className="text-mf-dim">Email</dt><dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : "—"}</dd>
            <dt className="text-mf-dim">Phone</dt><dd>{c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : "—"}</dd>
            <dt className="text-mf-dim">Source</dt><dd>{c.source ?? "—"}</dd>
            <dt className="text-mf-dim">Niche</dt><dd>{c.niche ?? "—"}</dd>
            <dt className="text-mf-dim">Brands</dt><dd>{c.brand_affinity?.length ? c.brand_affinity.join(", ") : "—"}</dd>
            <dt className="text-mf-dim">VIP</dt><dd><YesNo value={c.vip} /></dd>
            <dt className="text-mf-dim">Email opt-in</dt><dd><YesNo value={c.email_opt_in} /></dd>
            <dt className="text-mf-dim">SMS</dt><dd><SmsConsent c={c} />{c.sms_consent_at ? <span className="block text-xs text-mf-dim">consented {fmtDateTime(c.sms_consent_at)} via {c.sms_consent_source ?? "?"}</span> : null}{c.sms_opted_out_at ? <span className="block text-xs text-mf-dim">opted out {fmtDateTime(c.sms_opted_out_at)}</span> : null}</dd>
            <dt className="text-mf-dim">Screen</dt><dd>{c.screen_result ? <Badge tone={c.screen_result === "pass" ? "ok" : "warn"}>{c.screen_result}</Badge> : "—"}</dd>
            <dt className="text-mf-dim">Since</dt><dd>{fmtDateTime(c.created_at)}</dd>
          </dl>
        </Card>
        <div className="space-y-4 lg:col-span-2">
          <Card title={`Orders · ${orders?.length ?? 0}`}>
            <DataTable<BoardOrder> rows={orders ?? []} rowKey={(o) => o.id} rowHref={(o) => `/app/orders/${o.id}`} empty="No orders yet."
              columns={[
                { key: "n", header: "#", render: (o) => <span className="font-display text-lg text-mf-gold">#{o.number}</span> },
                { key: "s", header: "Status", render: (o) => <StatusBadge status={o.status} /> },
                { key: "d", header: "Due", render: (o) => <span className={isOverdue(o.due_date, o.status) ? "font-bold text-red-500" : ""}>{fmtDay(o.due_date)}</span> },
                { key: "l", header: "Lines", render: (o) => o.lines?.length ?? 0, hideSm: true },
                { key: "c", header: "Created", render: (o) => <span className="text-mf-muted">{fmtDateTime(o.created_at)}</span>, hideSm: true },
              ]} />
          </Card>
          <Card title={`Touches · ${touches?.length ?? 0}`}>
            {!touches?.length ? <p className="text-sm text-mf-dim">No outreach logged.</p> : (
              <ul className="divide-y divide-mf-line text-sm">
                {touches.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><Badge>{t.channel ?? t.campaign?.channel ?? "?"}</Badge> <span className="ml-1">{t.campaign?.name ?? "manual"}</span></span>
                    <span className="text-xs text-mf-muted">{fmtDateTime(t.sent_at)}{t.replied_at ? " · replied" : ""}{t.converted_order_id ? " · converted" : ""}</span>
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
