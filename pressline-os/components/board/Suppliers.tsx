"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PurchaseOrderRow } from "@/lib/supabase/types";
import { api } from "@/components/ui/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { Thumb } from "@/components/ui/Thumb";
import { fmtDateTime } from "@/components/ui/format";
import { Toast, type ToastState } from "@/components/ui/Toast";

type Po = PurchaseOrderRow & { order: { id: string; number: number } | null };
type Tab = "ss" | "sanmar" | "crew";
type SSBlank = { id?: string; style?: string | null; brand?: string | null; color: string; sizes?: string[] | null; qty?: number; price?: number; photo_front: string | null; photo_back?: string | null };

const CREW = [
  { key: "unity", name: "Unity", role: "Blanks / specialty", email: "orders@unity.example", template: "Hi Unity team,\n\nPlease quote and ship the following to Midnight Fusion LLC:\n\n- Style / color / sizes:\n- Qty:\n- Need-by date:\n\nPO # to follow on approval.\n\nThanks,\nMidnight Fusion" },
  { key: "danny", name: "Danny", role: "Contract screen printing", email: "danny@example.com", template: "Danny,\n\nGang sheet + blanks heading your way.\n\n- Order #:\n- Colors / locations:\n- Qty by size:\n- Due back by:\n\nFiles in the Drive folder. Holler with questions.\n\n— Midnight Fusion" },
  { key: "oceanaire", name: "Oceanaire", role: "Embroidery / caps", email: "orders@oceanaire.example", template: "Hi Oceanaire,\n\nNew embroidery run:\n\n- Order #:\n- Design (DST attached):\n- Blanks / qty by size:\n- Thread colors:\n- Need-by:\n\nThanks,\nMidnight Fusion" },
];

export function Suppliers({ pos, liveMoney }: { pos: Po[]; liveMoney: boolean }) {
  const [tab, setTab] = useState<Tab>("ss");
  return (
    <div className="space-y-4">
      <div className="flex border-b border-mf-line text-xs font-bold uppercase tracking-widest">
        {([["ss", "S&S Activewear"], ["sanmar", "SanMar"], ["crew", "Unity · Danny · Oceanaire"]] as [Tab, string][]).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-2 ${tab === k ? "border-mf-gold text-mf-gold" : "border-transparent text-mf-dim"}`}>{label}</button>
        ))}
      </div>
      {tab === "ss" ? <SSTab /> : tab === "sanmar" ? <SanMarTab /> : <CrewTab />}
      <PendingPos pos={pos} liveMoney={liveMoney} />
    </div>
  );
}

function SSTab() {
  const [style, setStyle] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ source: string; style?: { id: number; brand: string; name: string; title?: string }; blanks: SSBlank[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!style.trim()) return;
    setBusy(true); setError(null);
    try { setRes(await api(`/api/blanks?supplier=ss&style=${encodeURIComponent(style.trim())}`)); }
    catch (err) { setError(err instanceof Error ? err.message : "Search failed"); }
    finally { setBusy(false); }
  }
  return (
    <Card title="S&S live catalog">
      <form onSubmit={search} className="flex gap-2">
        <input className="input" placeholder="Style number — 5000, 3001, 1717, 18500…" value={style} onChange={(e) => setStyle(e.target.value)} />
        <Button type="submit" variant="solid" loading={busy}>Search</Button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      {res ? (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-widest text-mf-dim">{res.source === "ss" ? "Live from S&S" : "Cached blanks"}{res.style ? ` · ${res.style.brand} ${res.style.name}` : ""} · {res.blanks.length} colors</p>
          {res.blanks.length === 0 ? <p className="text-sm text-mf-dim">Nothing for that style.</p> : null}
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {res.blanks.map((b, i) => (
              <li key={`${b.id ?? b.color}-${i}`} className="border border-mf-line p-2 text-sm">
                <div className="flex gap-1">
                  <Thumb src={b.photo_front} className="h-20 w-1/2 object-cover" />
                  {b.photo_back ? <Thumb src={b.photo_back} className="h-20 w-1/2 object-cover" /> : null}
                </div>
                <p className="mt-1 font-bold">{b.brand ?? ""} {b.style ?? ""} {b.color}</p>
                <p className="text-xs text-mf-muted">{b.sizes?.join(" ") ?? ""}</p>
                <p className="mt-1 flex justify-between text-xs"><span>{b.qty !== undefined ? `${b.qty.toLocaleString()} in stock` : ""}</span>{b.price !== undefined ? <Money value={b.price} className="text-mf-gold" /> : null}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function SanMarTab() {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  async function refresh() {
    setBusy(true); setOut(null);
    try { const r = await api<{ upserted?: number }>("/api/blanks/sanmar-refresh", { method: "POST", body: {} }); setOut(`EPDD refreshed — ${r.upserted ?? 0} blanks upserted.`); }
    catch (err) { setOut(`Refresh failed: ${err instanceof Error ? err.message : "error"}`); }
    finally { setBusy(false); }
  }
  return (
    <Card title="SanMar">
      <p className="text-sm text-mf-muted">SanMar flat photos and prices come from the nightly EPDD import into the blanks table. Pull it now if a new style is missing.</p>
      <Button className="mt-3" variant="solid" onClick={refresh} loading={busy}>Refresh EPDD</Button>
      {out ? <p className="mt-2 text-sm">{out}</p> : null}
    </Card>
  );
}

function CrewTab() {
  const [text, setText] = useState<Record<string, string>>(Object.fromEntries(CREW.map((c) => [c.key, c.template])));
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {CREW.map((c) => (
        <Card key={c.key} title={c.name}>
          <p className="mb-2 text-xs uppercase tracking-widest text-mf-dim">{c.role}</p>
          <textarea className="input min-h-[14rem] font-mono text-xs" value={text[c.key]} onChange={(e) => setText((t) => ({ ...t, [c.key]: e.target.value }))} />
          <a className="btn mt-2 w-full justify-center" href={`mailto:${c.email}?subject=${encodeURIComponent(`PO from Midnight Fusion — ${c.name}`)}&body=${encodeURIComponent(text[c.key])}`}>Email PO</a>
        </Card>
      ))}
    </div>
  );
}

function PendingPos({ pos, liveMoney }: { pos: Po[]; liveMoney: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  async function approve(id: string) {
    if (liveMoney && !window.confirm("LIVE MONEY is on. Place this PO with the supplier for real?")) return;
    setBusy(id);
    try {
      const r = await api<{ dry_run?: boolean; po?: { status?: string } }>(`/api/po/${id}/approve`, { method: "POST", body: {} });
      setToast({ kind: "ok", text: r.dry_run ? "Approved as a dry run — nothing was sent (LIVE_MONEY off)." : `PO placed (${r.po?.status ?? "placed"}).` });
      router.refresh();
    } catch (err) { setToast({ kind: "err", text: err instanceof Error ? err.message : "Approve failed" }); }
    finally { setBusy(null); }
  }
  const pending = pos.filter((p) => p.status === "pending_approval");
  const rest = pos.filter((p) => p.status !== "pending_approval");
  const lineCount = (p: Po) => { const l = p.lines as { lines?: unknown[] } | unknown[] | null; return Array.isArray(l) ? l.length : (l?.lines?.length ?? 0); };
  return (
    <Card title={`Purchase orders · ${pending.length} pending`}>
      {pos.length === 0 ? <p className="text-sm text-mf-dim">No POs yet. Create one from an order.</p> : (
        <ul className="divide-y divide-mf-line text-sm">
          {[...pending, ...rest].map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {p.order ? <Link href={`/app/orders/${p.order.id}`} className="font-display text-lg no-underline">#{p.order.number}</Link> : <span className="text-mf-dim">no order</span>}
                <span className="ml-2 uppercase">{p.supplier ?? "?"}</span><span className="ml-2 text-xs text-mf-muted">{lineCount(p)} line(s) · {fmtDateTime(p.created_at)}</span>
                {p.supplier_po ? <span className="ml-2 font-mono text-xs">{p.supplier_po}</span> : null}
              </span>
              <span className="flex items-center gap-2">
                <Badge tone={p.status === "pending_approval" ? "warn" : p.status === "placed" ? "ok" : "muted"}>{p.status ?? "?"}</Badge>
                {p.status === "pending_approval" ? <Button size="sm" variant={liveMoney ? "blood" : "solid"} loading={busy === p.id} onClick={() => approve(p.id)}>Approve PO</Button> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </Card>
  );
}
