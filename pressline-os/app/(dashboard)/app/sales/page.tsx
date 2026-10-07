import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/supabase/service";
import type { CampaignRow, TouchRow } from "@/lib/supabase/types";
import { Card, PageHeader, Stat } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { fmtDateTime } from "@/components/ui/format";

export const metadata: Metadata = { title: "Sales" };
export const dynamic = "force-dynamic";

type Touch = TouchRow & { customer: { id: string; name: string | null; company: string | null } | null; campaign: { name: string | null } | null };

export default async function SalesPage() {
  const [{ data: campaigns }, { data: touches }, sms, email, total, optedOut] = await Promise.all([
    db().from("campaigns").select("*").order("name"),
    db().from("touches").select("*, customer:customers(id,name,company), campaign:campaigns(name)").order("sent_at", { ascending: false }).limit(100).overrideTypes<Touch[], { merge: false }>(),
    db().from("customers").select("id", { count: "exact", head: true }).not("sms_consent_at", "is", null).is("sms_opted_out_at", null),
    db().from("customers").select("id", { count: "exact", head: true }).eq("email_opt_in", true),
    db().from("customers").select("id", { count: "exact", head: true }),
    db().from("customers").select("id", { count: "exact", head: true }).not("sms_opted_out_at", "is", null),
  ]);
  const replies = (touches ?? []).filter((t) => t.replied_at).length;
  const conversions = (touches ?? []).filter((t) => t.converted_order_id).length;

  return (
    <>
      <PageHeader title="Hunting Party" subtitle="Campaigns, every touch, and who said yes to hearing from us." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Customers" value={total.count ?? 0} tone="cream" />
        <Stat label="SMS opted in" value={sms.count ?? 0} />
        <Stat label="Email opted in" value={email.count ?? 0} />
        <Stat label="SMS opted out" value={optedOut.count ?? 0} tone="blood" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Campaigns">
          {!campaigns?.length ? <p className="text-sm text-mf-dim">No campaigns. n8n workflows show up here once they run.</p> : (
            <ul className="divide-y divide-mf-line text-sm">
              {(campaigns as CampaignRow[]).map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <span><span className="font-bold">{c.name ?? c.id.slice(0, 8)}</span>{c.workflow ? <span className="block text-xs text-mf-dim">{c.workflow}</span> : null}</span>
                  <span className="flex gap-1"><Badge>{c.channel ?? "?"}</Badge><Badge tone={c.status === "active" ? "ok" : "muted"}>{c.status ?? "draft"}</Badge></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={`Touches · last ${touches?.length ?? 0}`} className="lg:col-span-2" action={<span className="text-xs text-mf-muted">{replies} replied · {conversions} converted</span>}>
          <DataTable<Touch> rows={touches ?? []} rowKey={(t) => t.id} empty="No touches yet."
            columns={[
              { key: "w", header: "When", render: (t) => <span className="text-mf-muted">{fmtDateTime(t.sent_at)}</span> },
              { key: "c", header: "Customer", render: (t) => t.customer ? <Link href={`/app/customers/${t.customer.id}`}>{t.customer.company ?? t.customer.name ?? "—"}</Link> : "—" },
              { key: "ch", header: "Channel", render: (t) => <Badge>{t.channel ?? "?"}</Badge> },
              { key: "ca", header: "Campaign", render: (t) => t.campaign?.name ?? "manual", hideSm: true },
              { key: "r", header: "Result", render: (t) => t.converted_order_id ? <Badge tone="ok">converted</Badge> : t.replied_at ? <Badge tone="gold">replied</Badge> : <span className="text-mf-dim">—</span> },
            ]} />
        </Card>
      </div>
    </>
  );
}
