"use client";
import Link from "next/link";
import { useState } from "react";
import { LabelForm } from "./LabelForm";
import type { BoardOrder } from "./types";
import { fmtDay } from "@/components/ui/format";

export function ShipPacked({ orders }: { orders: (BoardOrder & { customer: { id: string; name: string | null; company: string | null; phone?: string | null } | null })[] }) {
  const [open, setOpen] = useState<string | null>(orders[0]?.id ?? null);
  if (!orders.length) return <p className="py-6 text-center text-sm uppercase tracking-widest text-mf-dim">Nothing packed. Go print something.</p>;
  return (
    <ul className="divide-y divide-mf-line">
      {orders.map((o) => (
        <li key={o.id} className="py-3">
          <button type="button" onClick={() => setOpen((v) => (v === o.id ? null : o.id))} className="flex w-full items-center justify-between text-left">
            <span><Link href={`/app/orders/${o.id}`} className="font-display text-2xl text-mf-gold no-underline">#{o.number}</Link><span className="ml-3 text-sm">{o.customer?.company ?? o.customer?.name ?? "—"}</span></span>
            <span className="text-xs text-mf-muted">due {fmtDay(o.due_date)} · {o.lines?.length ?? 0} lines {open === o.id ? "▲" : "▼"}</span>
          </button>
          {open === o.id ? <div className="mt-3 border border-mf-line p-3"><LabelForm orderId={o.id} orderNumber={o.number} customer={o.customer} onDone={() => setOpen(null)} /></div> : null}
        </li>
      ))}
    </ul>
  );
}
