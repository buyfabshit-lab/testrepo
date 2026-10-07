import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/supabase/service";
import { STATUS_COLORS, isOrderStatus } from "@/lib/orders/status";
import { PageHeader } from "@/components/ui/Card";
import { todayLA } from "@/components/ui/format";

export const metadata: Metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

type Chip = { id: string; number: number; status: string | null; due_date: string | null; rush: boolean | null; customer: { name: string | null; company: string | null } | null };

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const today = todayLA();
  const m = /^\d{4}-\d{2}$/.test(month ?? "") ? (month as string) : today.slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const last = new Date(Date.UTC(y, mo, 0));
  const gridStart = addDays(first, -first.getUTCDay());
  const gridEnd = addDays(last, 6 - last.getUTCDay());
  const prev = `${new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7)}`;
  const next = `${new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7)}`;
  const title = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(first);

  const { data } = await db().from("orders").select("id, number, status, due_date, rush, customer:customers(name, company)")
    .gte("due_date", ymd(gridStart)).lte("due_date", ymd(gridEnd)).not("status", "in", "(CANCELLED)").order("number")
    .overrideTypes<Chip[], { merge: false }>();
  const byDay = new Map<string, Chip[]>();
  for (const o of data ?? []) { if (o.due_date) byDay.set(o.due_date, [...(byDay.get(o.due_date) ?? []), o]); }

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  return (
    <>
      <PageHeader title={title} subtitle="Due dates. Every night at 00:00 the gang run builds."
        actions={<><Link href={`/app/calendar?month=${prev}`} className="btn">‹ Prev</Link><Link href="/app/calendar" className="btn">Today</Link><Link href={`/app/calendar?month=${next}`} className="btn">Next ›</Link></>} />
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="grid min-w-[760px] grid-cols-7 gap-px border border-mf-line bg-mf-line">
          {WEEKDAYS.map((w) => <div key={w} className="bg-mf-panel px-2 py-1 text-[.65rem] font-bold uppercase tracking-widest text-mf-dim">{w}</div>)}
          {days.map((d) => {
            const key = ymd(d);
            const inMonth = d.getUTCMonth() === mo - 1;
            const isToday = key === today;
            const chips = byDay.get(key) ?? [];
            return (
              <div key={key} className={`min-h-[7.5rem] bg-mf-bg p-1.5 ${inMonth ? "" : "opacity-40"} ${isToday ? "ring-1 ring-inset ring-mf-gold" : ""}`}>
                <p className={`mb-1 text-right font-display text-sm ${isToday ? "text-mf-gold" : "text-mf-muted"}`}>{d.getUTCDate()}</p>
                <p className="mb-1 truncate border-l-2 border-mf-gold bg-mf-panel px-1 py-0.5 text-[.6rem] uppercase tracking-wider text-mf-muted" title="Midnight gang run">00:00 Midnight gang run</p>
                <ul className="space-y-0.5">
                  {chips.map((o) => {
                    const c = isOrderStatus(o.status) ? STATUS_COLORS[o.status] : { hex: "#334155", text: "#fff" };
                    return (
                      <li key={o.id}>
                        <Link href={`/app/orders/${o.id}`} title={`#${o.number} ${o.customer?.name ?? ""} · ${o.status}`}
                          className="block truncate px-1 py-0.5 text-[.65rem] font-bold no-underline" style={{ background: c.hex, color: c.text }}>
                          #{o.number}{o.rush ? " ⚡" : ""} {o.customer?.company ?? o.customer?.name ?? ""}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
