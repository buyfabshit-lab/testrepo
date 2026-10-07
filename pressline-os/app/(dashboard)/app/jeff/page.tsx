import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/supabase/service";
import { STATUS_COLORS, type OrderStatus } from "@/lib/orders/status";
import { BOARD_SELECT, type BoardOrder } from "@/components/board/types";
import { MarkStatusButton } from "@/components/board/MarkPackedButton";
import { StatusBadge } from "@/components/ui/Badge";
import { fmtDay, isOverdue, todayLA } from "@/components/ui/format";

export const metadata: Metadata = { title: "Jeff" };
export const dynamic = "force-dynamic";

const ACTIVE: OrderStatus[] = ["NEW", "QUOTED", "APPROVED", "PAID", "BLANKS_ORDERED", "ART_READY", "ON_GANG_SHEET", "PRINTED", "PACKED", "HOLD"];

export default async function JeffPage() {
  const today = todayLA();
  const { data } = await db().from("orders").select(BOARD_SELECT).in("status", ACTIVE).order("due_date", { ascending: true, nullsFirst: false }).limit(500)
    .overrideTypes<BoardOrder[], { merge: false }>();
  const orders = data ?? [];
  const tiles = [
    { key: "today", title: "Due today", color: STATUS_COLORS.ART_READY.hex, text: STATUS_COLORS.ART_READY.text, rows: orders.filter((o) => o.due_date === today) },
    { key: "overdue", title: "Overdue", color: STATUS_COLORS.HOLD.hex, text: STATUS_COLORS.HOLD.text, rows: orders.filter((o) => isOverdue(o.due_date, o.status, today)) },
    { key: "packed", title: "Packed, needs label", color: STATUS_COLORS.PACKED.hex, text: STATUS_COLORS.PACKED.text, rows: orders.filter((o) => o.status === "PACKED"), href: "/app/shipping" },
    { key: "printed", title: "Printed, pack me", color: STATUS_COLORS.PRINTED.hex, text: STATUS_COLORS.PRINTED.text, rows: orders.filter((o) => o.status === "PRINTED"), pack: true },
  ];

  return (
    <>
      <h1 className="mb-1 text-4xl text-mf-gold">Jeff</h1>
      <p className="mb-4 text-sm text-mf-muted">{fmtDay(today, true)} · {orders.length} live orders</p>
      <div className="grid gap-4 md:grid-cols-2">
        {tiles.map((t) => (
          <section key={t.key} className="panel">
            <header className="flex items-center justify-between px-4 py-3 font-display text-xl uppercase tracking-[.12em]" style={{ background: t.color, color: t.text }}>
              <span>{t.title}</span><span className="rounded bg-black/25 px-2 text-lg">{t.rows.length}</span>
            </header>
            <ul className="divide-y divide-mf-line">
              {t.rows.length === 0 ? <li className="px-4 py-6 text-center text-sm uppercase tracking-widest text-mf-dim">clear</li> : null}
              {t.rows.map((o) => (
                <li key={o.id} className="p-2">
                  <Link href={`/app/orders/${o.id}`} className="flex min-h-[4.5rem] items-center justify-between gap-3 px-2 py-2 no-underline active:bg-mf-bg">
                    <div className="min-w-0">
                      <p className="font-display text-3xl leading-none text-mf-gold">#{o.number}{o.rush ? <span className="ml-2 text-base text-mf-blood">RUSH</span> : null}</p>
                      <p className="truncate text-base text-mf-cream">{o.customer?.company ?? o.customer?.name ?? "—"}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusBadge status={o.status} />
                      <p className={`mt-1 text-sm ${isOverdue(o.due_date, o.status, today) ? "font-bold text-red-500" : "text-mf-muted"}`}>{fmtDay(o.due_date)}</p>
                      <p className="text-xs text-mf-dim">{o.lines?.length ?? 0} lines</p>
                    </div>
                  </Link>
                  {t.pack ? <MarkStatusButton orderId={o.id} to="PACKED" label="Mark packed" className="px-2 pb-2" /> : null}
                  {t.href && o.status === "PACKED" ? <Link href={t.href} className="btn mx-2 mb-2 flex justify-center">Buy label</Link> : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
