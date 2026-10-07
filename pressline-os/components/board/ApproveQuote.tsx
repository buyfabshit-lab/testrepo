"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/components/ui/api";
import { Money } from "@/components/ui/Money";

/** The one-tap phone approve. Giant total, giant gold button, nothing else to fumble. */
export function ApproveQuote({ quoteId, total, status, customer, lines }: {
  quoteId: string; total: number; status: string | null;
  customer: { name: string | null; company: string | null } | null;
  lines: { title: string; qty: number; method: string; line: number }[];
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ proof_url: string; number?: number; orderId?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true); setError(null);
    try {
      const res = await api<{ order: { id: string; number: number }; proof_url: string }>(`/api/quotes/${quoteId}/approve`, { method: "POST", body: {} });
      setDone({ proof_url: res.proof_url, number: res.order?.number, orderId: res.order?.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-stretch gap-5 py-2">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[.3em] text-mf-muted">{customer?.company ?? customer?.name ?? "Customer"}</p>
        {customer?.company && customer?.name ? <p className="text-sm text-mf-muted">{customer.name}</p> : null}
        <p className="mt-3 font-display text-7xl leading-none text-mf-gold"><Money value={total} /></p>
        <p className="mt-1 text-[.65rem] uppercase tracking-widest text-mf-dim">quote {quoteId.slice(0, 8)} · {status ?? "draft"}</p>
      </div>

      <ul className="panel divide-y divide-mf-line">
        {lines.map((l, i) => (
          <li key={i} className="flex items-center justify-between px-4 py-3 text-base">
            <span><span className="font-bold">{l.qty}×</span> {l.title} <span className="text-xs text-mf-muted">{l.method.toUpperCase()}</span></span>
            <Money value={l.line} className="text-mf-gold" />
          </li>
        ))}
        {lines.length === 0 ? <li className="px-4 py-3 text-sm text-mf-dim">No lines on this quote.</li> : null}
      </ul>

      {done ? (
        <div className="panel border-mf-gold p-5 text-center">
          <p className="font-display text-3xl uppercase text-mf-gold">Approved{done.number ? ` · #${done.number}` : ""}</p>
          <p className="mt-2 text-sm text-mf-muted">Proof link for the customer:</p>
          <a href={done.proof_url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm">{done.proof_url}</a>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" className="btn justify-center" onClick={() => { void navigator.clipboard?.writeText(done.proof_url).catch(() => window.prompt("Copy the proof link", done.proof_url)); }}>Copy link</button>
            {done.orderId ? <Link href={`/app/orders/${done.orderId}`} className="btn btn-solid justify-center">Open order</Link> : <Link href="/app/board" className="btn btn-solid justify-center">Board</Link>}
          </div>
        </div>
      ) : (
        <button type="button" onClick={approve} disabled={busy || status === "approved"}
          className="btn btn-solid w-full justify-center !py-7 font-display !text-4xl !tracking-[.2em] disabled:opacity-50">
          {busy ? "…" : status === "approved" ? "Approved" : "APPROVE"}
        </button>
      )}
      {error ? <p className="text-center text-sm text-red-400">{error}</p> : null}
      <p className="text-center"><Link href={`/app/quotes/${quoteId}`} className="text-xs uppercase tracking-widest text-mf-dim">Decline</Link></p>
    </div>
  );
}
