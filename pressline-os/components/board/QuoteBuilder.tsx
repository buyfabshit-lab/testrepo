"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { priceQuote, sumSizes, type PriceRule, type QuoteLineInput } from "@/lib/pricing";
import { api } from "@/components/ui/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Thumb } from "@/components/ui/Thumb";
import { Toast, type ToastState } from "@/components/ui/Toast";

export type BuilderCustomer = { id: string; name: string | null; company: string | null; email: string | null };
export type BuilderBlank = { id: string | null; supplier?: string | null; style: string | null; brand: string | null; color: string | null; sizes?: string[] | null; cost: number | null; photo_front?: string | null; supplier_style_id?: string | null };

const METHODS: QuoteLineInput["method"][] = ["screen", "dtf", "emb", "uv"];
const SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];
const LOCATIONS = ["front", "back", "left_chest", "right_chest", "left_sleeve", "right_sleeve", "nape"];

type Line = { key: string; blank: BuilderBlank | null; method: QuoteLineInput["method"]; sizes: Record<string, number>; locations: string[]; colors: number };

const newLine = (): Line => ({ key: Math.random().toString(36).slice(2), blank: null, method: "screen", sizes: {}, locations: ["front"], colors: 1 });

export function QuoteBuilder({ customers, rules, blanks }: { customers: BuilderCustomer[]; rules: PriceRule[]; blanks: BuilderBlank[] }) {
  const router = useRouter();
  const [custQ, setCustQ] = useState("");
  const [customer, setCustomer] = useState<BuilderCustomer | null>(null);
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [rush, setRush] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const custMatches = useMemo(() => {
    const q = custQ.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers.filter((c) => [c.name, c.company, c.email].some((v) => v?.toLowerCase().includes(q))).slice(0, 8);
  }, [custQ, customers]);

  const priced = useMemo(() => priceQuote(
    lines.map((l) => ({ method: l.method, qty: sumSizes(l.sizes) || 0, blankCost: Number(l.blank?.cost ?? 0), locations: l.locations.length || 1, colors: l.colors, rush })),
    rules,
  ), [lines, rules, rush]);

  const update = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  async function save() {
    if (!customer) { setToast({ kind: "err", text: "Pick a customer first" }); return; }
    const bad = lines.find((l) => sumSizes(l.sizes) === 0);
    if (bad) { setToast({ kind: "err", text: "Every line needs at least one piece" }); return; }
    setBusy(true);
    try {
      const res = await api<{ quote: { id: string } }>("/api/quotes", {
        body: {
          customer_id: customer.id, rush,
          lines: lines.map((l) => ({
            blank_id: l.blank?.id ?? null, blank_cost: Number(l.blank?.cost ?? 0), method: l.method, sizes: l.sizes,
            locations: l.locations.length ? l.locations : ["front"], colors: l.colors,
            label: l.blank ? `${l.blank.brand ?? ""} ${l.blank.style ?? ""} ${l.blank.color ?? ""}`.trim() : undefined,
          })),
        },
      });
      router.push(`/app/quotes/${res.quote.id}`);
    } catch (err) {
      setToast({ kind: "err", text: err instanceof Error ? err.message : "Save failed" });
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card title="Customer">
          {customer ? (
            <div className="flex items-center justify-between gap-3">
              <div><p className="font-bold">{customer.name ?? "—"}</p><p className="text-xs text-mf-muted">{customer.company ?? ""} {customer.email ?? ""}</p></div>
              <Button size="sm" onClick={() => setCustomer(null)}>Change</Button>
            </div>
          ) : (
            <>
              <input className="input" placeholder="Search name, company, email" value={custQ} onChange={(e) => setCustQ(e.target.value)} autoFocus />
              <ul className="mt-2 divide-y divide-mf-line border border-mf-line">
                {custMatches.length === 0 ? <li className="p-3 text-sm text-mf-dim">No match. Capture them at /join first.</li> : null}
                {custMatches.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setCustomer(c)} className="block w-full px-3 py-2.5 text-left text-sm hover:bg-mf-bg">
                      <span className="font-bold">{c.name ?? "—"}</span><span className="ml-2 text-xs text-mf-muted">{c.company ?? ""} {c.email ?? ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        {lines.map((l, i) => (
          <LineEditor key={l.key} index={i} line={l} blanks={blanks} priced={priced.lines[i]}
            onChange={(patch) => update(l.key, patch)} onRemove={lines.length > 1 ? () => setLines((ls) => ls.filter((x) => x.key !== l.key)) : undefined} />
        ))}
        <Button onClick={() => setLines((ls) => [...ls, newLine()])}>+ Add line</Button>
      </div>

      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card title="Price">
          <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={rush} onChange={(e) => setRush(e.target.checked)} /> Rush (×1.25)</label>
          <ul className="space-y-1 text-sm">
            {priced.lines.map((p, i) => (
              <li key={lines[i].key} className="flex justify-between"><span className="text-mf-muted">Line {i + 1} · {p.qty} × <Money value={p.unit} />{p.setup ? ` + ${p.setup} setup` : ""}</span><Money value={p.line} /></li>
            ))}
          </ul>
          {priced.lines.some((p) => !p.rule && p.qty > 0) ? <p className="mt-2 text-xs text-red-400">A line has no matching price rule for its qty/method.</p> : null}
          <p className="mt-4 flex items-end justify-between border-t border-mf-line pt-3"><span className="label !mb-0">Total</span><Money value={priced.total} className="font-display text-4xl text-mf-gold" /></p>
          <Button variant="solid" size="lg" className="mt-4 w-full justify-center" loading={busy} onClick={save}>Save quote</Button>
        </Card>
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function LineEditor({ index, line, blanks, priced, onChange, onRemove }: {
  index: number; line: Line; blanks: BuilderBlank[]; priced: { unit: number; line: number } | undefined;
  onChange: (patch: Partial<Line>) => void; onRemove?: () => void;
}) {
  const [q, setQ] = useState("");
  const [live, setLive] = useState<BuilderBlank[] | null>(null);
  const [searching, setSearching] = useState(false);

  const local = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return blanks.slice(0, 6);
    return blanks.filter((b) => [b.style, b.brand, b.color].some((v) => v?.toLowerCase().includes(s))).slice(0, 12);
  }, [q, blanks]);

  async function searchSS() {
    if (!q.trim()) return;
    setSearching(true);
    try {
      type SSBlank = { id?: string; color: string; sizes: string[]; qty?: number; price?: number; cost?: number; photo_front: string | null; brand?: string | null; style?: string | null };
      const res = await api<{ source: string; style?: { id: number; brand: string; name: string }; blanks: SSBlank[] }>(`/api/blanks?supplier=ss&style=${encodeURIComponent(q.trim())}`);
      setLive(res.blanks.map((b) => ({
        id: b.id ?? null, supplier: "ss", style: b.style ?? res.style?.name ?? q.trim(), brand: b.brand ?? res.style?.brand ?? null, color: b.color,
        sizes: b.sizes, cost: b.price ?? b.cost ?? null, photo_front: b.photo_front, supplier_style_id: res.style ? String(res.style.id) : null,
      })));
    } catch {
      setLive([]);
    } finally {
      setSearching(false);
    }
  }

  const options = live ?? local;
  const qty = sumSizes(line.sizes);

  return (
    <Card title={`Line ${index + 1}`} action={onRemove ? <Button size="sm" variant="ghost" onClick={onRemove}>Remove</Button> : null}>
      <div className="space-y-3">
        <div>
          <span className="label">Blank</span>
          {line.blank ? (
            <div className="flex items-center justify-between gap-3 border border-mf-gold p-2">
              <div className="flex items-center gap-2">
                {line.blank.photo_front ? <Thumb src={line.blank.photo_front} className="h-10 w-10 object-cover" /> : null}
                <div><p className="text-sm font-bold">{line.blank.brand} {line.blank.style}</p><p className="text-xs text-mf-muted">{line.blank.color} · cost <Money value={line.blank.cost} />{line.blank.id ? "" : " · live S&S (not cached)"}</p></div>
              </div>
              <Button size="sm" onClick={() => onChange({ blank: null })}>Change</Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input className="input" placeholder="Style (5000, 3001, 1717…)" value={q} onChange={(e) => { setQ(e.target.value); setLive(null); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void searchSS(); } }} />
                <Button size="sm" onClick={searchSS} loading={searching}>S&amp;S</Button>
              </div>
              <ul className="mt-2 max-h-56 divide-y divide-mf-line overflow-y-auto border border-mf-line">
                {options.length === 0 ? <li className="p-3 text-sm text-mf-dim">{live ? "Nothing live for that style." : "No cached blanks match."}</li> : null}
                {options.map((b, i) => (
                  <li key={`${b.id ?? "live"}-${i}`}>
                    <button type="button" onClick={() => onChange({ blank: b })} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-mf-bg">
                      <Thumb src={b.photo_front} className="h-8 w-8 object-cover" />
                      <span className="flex-1"><span className="font-bold">{b.brand} {b.style}</span> <span className="text-mf-muted">{b.color}</span></span>
                      <Money value={b.cost} className="text-xs text-mf-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label><span className="label">Method</span>
            <select className="input" value={line.method} onChange={(e) => onChange({ method: e.target.value as QuoteLineInput["method"] })}>
              {METHODS.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
          </label>
          <label><span className="label">Colors</span>
            <input className="input" type="number" min={0} max={12} value={line.colors} onChange={(e) => onChange({ colors: Math.max(0, Number(e.target.value) || 0) })} />
          </label>
        </div>

        <div>
          <span className="label">Sizes · {qty} pcs</span>
          <div className="grid grid-cols-6 gap-1">
            {SIZES.map((s) => (
              <label key={s} className="text-center">
                <span className="block text-[.6rem] font-bold uppercase text-mf-dim">{s}</span>
                <input className="input !px-1 text-center" type="number" inputMode="numeric" min={0} value={line.sizes[s] ?? ""} placeholder="0"
                  onChange={(e) => { const n = Math.max(0, Number(e.target.value) || 0); const sizes = { ...line.sizes }; if (n) sizes[s] = n; else delete sizes[s]; onChange({ sizes }); }} />
              </label>
            ))}
          </div>
        </div>

        <div>
          <span className="label">Locations</span>
          <div className="flex flex-wrap gap-1.5">
            {LOCATIONS.map((loc) => {
              const on = line.locations.includes(loc);
              return (
                <label key={loc} className={`badge cursor-pointer border ${on ? "border-mf-gold bg-mf-gold text-mf-bg" : "border-mf-line text-mf-muted"}`}>
                  <input type="checkbox" className="sr-only" checked={on} onChange={(e) => onChange({ locations: e.target.checked ? [...line.locations, loc] : line.locations.filter((x) => x !== loc) })} />
                  {loc.replace("_", " ")}
                </label>
              );
            })}
          </div>
        </div>

        <p className="text-right text-sm text-mf-muted">{qty} × <Money value={priced?.unit} /> = <Money value={priced?.line} className="font-bold text-mf-gold" /></p>
      </div>
    </Card>
  );
}
