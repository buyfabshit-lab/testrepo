"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { BOARD_LANES, STATUS_COLORS, STATUS_LABELS, type OrderStatus } from "@/lib/orders/status";
import { browserClient } from "@/lib/supabase/browser";
import type { OrderRow } from "@/lib/supabase/types";
import { api } from "@/components/ui/api";
import { Toast, type ToastState } from "@/components/ui/Toast";
import { fmtDay, isOverdue, todayLA } from "@/components/ui/format";
import type { BoardOrder } from "./types";

export function Board({ initial }: { initial: BoardOrder[] }) {
  const router = useRouter();
  const [orders, setOrders] = useState<BoardOrder[]>(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<OrderStatus | null>(null);
  const [moveFor, setMoveFor] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const today = todayLA();

  // Server re-render (router.refresh) hands us fresh data.
  useEffect(() => { setOrders(initial); }, [initial]);

  // Realtime: patch UPDATEs in place, refetch on INSERT/DELETE.
  useEffect(() => {
    const supa = browserClient();
    const channel = supa
      .channel("board-orders")
      .on("postgres_changes", { event: "*", schema: "pressline", table: "orders" }, (payload) => {
        if (payload.eventType === "UPDATE") {
          const row = payload.new as OrderRow;
          setOrders((prev) => {
            const idx = prev.findIndex((o) => o.id === row.id);
            if (idx === -1) { router.refresh(); return prev; }
            const next = prev.slice();
            next[idx] = { ...next[idx], ...row };
            return next;
          });
        } else if (payload.eventType === "DELETE") {
          const id = (payload.old as Partial<OrderRow>).id;
          setOrders((prev) => prev.filter((o) => o.id !== id));
        } else {
          router.refresh();
        }
      })
      .subscribe();
    return () => { supa.removeChannel(channel); };
  }, [router]);

  const byLane = useMemo(() => {
    const m = new Map<OrderStatus, BoardOrder[]>();
    for (const lane of BOARD_LANES) m.set(lane, []);
    for (const o of orders) {
      const s = (o.status ?? "NEW") as OrderStatus;
      m.get(s)?.push(o);
    }
    return m;
  }, [orders]);

  const move = useCallback(async (id: string, to: OrderStatus) => {
    const prev = orders.find((o) => o.id === id);
    if (!prev || prev.status === to) return;
    const from = prev.status;
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, status: to } : o)));
    try {
      await api(`/api/orders/${id}/status`, { method: "PATCH", body: { status: to, force: true } });
      setToast({ kind: "ok", text: `#${prev.number} → ${STATUS_LABELS[to]}` });
    } catch (err) {
      setOrders((os) => os.map((o) => (o.id === id ? { ...o, status: from } : o)));
      setToast({ kind: "err", text: `Could not move #${prev.number}: ${err instanceof Error ? err.message : "error"}` });
    }
  }, [orders]);

  function onDragStart(e: DragEvent, id: string) {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDragging(id);
  }
  function onDrop(e: DragEvent, lane: OrderStatus) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragging;
    setOver(null); setDragging(null);
    if (id) void move(id, lane);
  }

  return (
    <>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
        {BOARD_LANES.map((lane) => {
          const c = STATUS_COLORS[lane];
          const cards = byLane.get(lane) ?? [];
          return (
            <section key={lane}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== lane) setOver(lane); }}
              onDragLeave={() => setOver((o) => (o === lane ? null : o))}
              onDrop={(e) => onDrop(e, lane)}
              className={`panel flex w-[82vw] shrink-0 snap-start flex-col sm:w-72 ${over === lane ? "ring-2 ring-mf-gold" : ""}`}
              style={{ minHeight: "60vh" }}>
              <header className="flex items-center justify-between px-3 py-2 font-display text-sm uppercase tracking-[.15em]" style={{ background: c.hex, color: c.text }}>
                <span>{STATUS_LABELS[lane]}</span>
                <span className="rounded bg-black/25 px-1.5 text-xs">{cards.length}</span>
              </header>
              <div className="flex-1 space-y-2 p-2">
                {cards.length === 0 ? <p className="py-6 text-center text-[.65rem] uppercase tracking-widest text-mf-dim">empty</p> : null}
                {cards.map((o) => (
                  <OrderCard key={o.id} order={o} today={today} dragging={dragging === o.id}
                    onDragStart={(e) => onDragStart(e, o.id)} onDragEnd={() => { setDragging(null); setOver(null); }}
                    onMove={() => setMoveFor(o.id)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {moveFor ? (
        <MoveSheet order={orders.find((o) => o.id === moveFor) ?? null} onClose={() => setMoveFor(null)}
          onPick={(s) => { const id = moveFor; setMoveFor(null); void move(id, s); }} />
      ) : null}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}

function OrderCard({ order: o, today, dragging, onDragStart, onDragEnd, onMove }: {
  order: BoardOrder; today: string; dragging: boolean;
  onDragStart: (e: DragEvent) => void; onDragEnd: () => void; onMove: () => void;
}) {
  const overdue = isOverdue(o.due_date, o.status, today);
  const lines = o.lines?.length ?? 0;
  return (
    <article draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
      className={`cursor-grab border border-mf-line bg-mf-bg p-2.5 active:cursor-grabbing ${dragging ? "opacity-40" : ""} ${o.rush ? "border-l-4 border-l-mf-blood" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/app/orders/${o.id}`} className="font-display text-xl text-mf-gold no-underline">#{o.number}</Link>
        {o.rush ? <span className="badge bg-mf-blood text-mf-cream">Rush</span> : null}
      </div>
      <p className="truncate text-sm text-mf-cream">{o.customer?.name ?? "No customer"}</p>
      {o.customer?.company ? <p className="truncate text-xs text-mf-muted">{o.customer.company}</p> : null}
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className={overdue ? "font-bold text-red-500" : "text-mf-muted"}>
          {o.due_date ? `Due ${fmtDay(o.due_date)}` : "No due date"}{overdue ? " · late" : ""}
        </span>
        <span className="text-mf-dim">{lines} line{lines === 1 ? "" : "s"}</span>
      </div>
      <button type="button" onClick={onMove} className="mt-2 w-full border border-mf-line py-1.5 text-[.65rem] font-bold uppercase tracking-widest text-mf-muted hover:border-mf-gold hover:text-mf-gold">
        Move
      </button>
    </article>
  );
}

function MoveSheet({ order, onClose, onPick }: { order: BoardOrder | null; onClose: () => void; onPick: (s: OrderStatus) => void }) {
  if (!order) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/70 md:items-center md:justify-center" onClick={onClose}>
      <div className="panel w-full max-h-[80vh] overflow-y-auto p-4 md:w-96" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl text-mf-gold">Move #{order.number}</h2>
        <p className="mb-3 text-xs text-mf-muted">{order.customer?.name ?? ""} · now {STATUS_LABELS[(order.status ?? "NEW") as OrderStatus]}</p>
        <div className="grid grid-cols-2 gap-2">
          {BOARD_LANES.map((s) => (
            <button key={s} type="button" disabled={s === order.status} onClick={() => onPick(s)}
              className="py-3 font-display text-sm uppercase tracking-widest disabled:opacity-30"
              style={{ background: STATUS_COLORS[s].hex, color: STATUS_COLORS[s].text }}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="btn mt-4 w-full justify-center">Cancel</button>
      </div>
    </div>
  );
}
