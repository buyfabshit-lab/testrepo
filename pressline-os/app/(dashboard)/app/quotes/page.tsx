import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/supabase/service";
import type { QuoteRow } from "@/lib/supabase/types";
import { Card, PageHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { fmtDateTime } from "@/components/ui/format";
import { quoteLines } from "@/components/board/quoteLines";

export const metadata: Metadata = { title: "Quotes" };
export const dynamic = "force-dynamic";

type Q = QuoteRow & { customer: { id: string; name: string | null; company: string | null } | null };
const TONE: Record<string, Tone> = { draft: "muted", sent: "gold", approved: "ok", declined: "bad" };

export default async function QuotesPage() {
  const { data, error } = await db().from("quotes").select("*, customer:customers(id,name,company)").order("created_at", { ascending: false }).limit(200)
    .overrideTypes<Q[], { merge: false }>();
  const rows = data ?? [];
  return (
    <>
      <PageHeader title="Quotes" subtitle={error ? error.message : `${rows.length} quotes`} actions={<Link href="/app/quotes/new" className="btn btn-solid">New quote</Link>} />
      <Card>
        <DataTable<Q>
          rows={rows} rowKey={(q) => q.id} rowHref={(q) => `/app/quotes/${q.id}`} empty="No quotes yet. Build one."
          columns={[
            { key: "c", header: "Customer", render: (q) => (<><span className="font-bold">{q.customer?.name ?? "—"}</span>{q.customer?.company ? <span className="block text-xs text-mf-muted">{q.customer.company}</span> : null}</>) },
            { key: "s", header: "Status", render: (q) => <Badge tone={TONE[q.status ?? "draft"] ?? "muted"}>{q.status ?? "draft"}</Badge> },
            { key: "t", header: "Total", render: (q) => <Money value={q.total} className="text-mf-gold" />, className: "text-right" },
            { key: "l", header: "Lines", render: (q) => quoteLines(q.lines).length, hideSm: true },
            { key: "d", header: "Created", render: (q) => <span className="text-mf-muted">{fmtDateTime(q.created_at)}</span>, hideSm: true },
            { key: "a", header: "", render: (q) => <Link href={`/app/quotes/${q.id}/approve`} className="badge border border-mf-gold text-mf-gold no-underline">Approve</Link>, className: "text-right" },
          ]}
        />
      </Card>
    </>
  );
}
