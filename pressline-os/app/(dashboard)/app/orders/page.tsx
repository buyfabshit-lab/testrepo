import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/supabase/service";
import { BOARD_LANES, STATUS_COLORS, STATUS_LABELS, isOrderStatus } from "@/lib/orders/status";
import { BOARD_SELECT, type BoardOrder } from "@/components/board/types";
import { PageHeader, Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { fmtDay, fmtDateTime, isOverdue, todayLA } from "@/components/ui/format";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = isOrderStatus(status) ? status : null;
  let q = db().from("orders").select(BOARD_SELECT).order("created_at", { ascending: false }).limit(300);
  if (filter) q = q.eq("status", filter);
  const { data, error } = await q.overrideTypes<BoardOrder[], { merge: false }>();
  const rows = data ?? [];
  const today = todayLA();

  return (
    <>
      <PageHeader title="Orders" subtitle={error ? error.message : `${rows.length} shown`} />
      <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        <Link href="/app/orders" className={`badge shrink-0 border no-underline ${!filter ? "border-mf-gold text-mf-gold" : "border-mf-line text-mf-muted"}`}>All</Link>
        {[...BOARD_LANES, "CANCELLED" as const].map((s) => (
          <Link key={s} href={`/app/orders?status=${s}`} className="badge shrink-0 no-underline"
            style={filter === s ? { background: STATUS_COLORS[s].hex, color: STATUS_COLORS[s].text } : { border: `1px solid ${STATUS_COLORS[s].hex}`, color: STATUS_COLORS[s].hex }}>
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>
      <Card padded={false} className="p-4">
        <DataTable<BoardOrder>
          rows={rows}
          rowKey={(o) => o.id}
          rowHref={(o) => `/app/orders/${o.id}`}
          empty="No orders match."
          columns={[
            { key: "n", header: "#", render: (o) => <span className="font-display text-lg text-mf-gold">#{o.number}</span> },
            { key: "c", header: "Customer", render: (o) => (<><span>{o.customer?.name ?? "—"}</span>{o.customer?.company ? <span className="block text-xs text-mf-muted">{o.customer.company}</span> : null}</>) },
            { key: "s", header: "Status", render: (o) => <StatusBadge status={o.status} /> },
            { key: "d", header: "Due", render: (o) => <span className={isOverdue(o.due_date, o.status, today) ? "font-bold text-red-500" : ""}>{fmtDay(o.due_date)}</span> },
            { key: "r", header: "Rush", render: (o) => (o.rush ? <Badge tone="blood">Rush</Badge> : null), hideSm: true },
            { key: "l", header: "Lines", render: (o) => o.lines?.length ?? 0, hideSm: true },
            { key: "t", header: "Created", render: (o) => <span className="text-mf-muted">{fmtDateTime(o.created_at)}</span>, hideSm: true },
          ]}
        />
      </Card>
    </>
  );
}
