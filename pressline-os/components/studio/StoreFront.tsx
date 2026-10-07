"use client";

import { useState } from "react";

export type Tier = { min: number; pct: number };
export type StoreProduct = { id: string; title: string; price: number; image: string | null; sizes: string[]; blank: string | null };

type Props = { slug: string; products: StoreProduct[]; wholesale: boolean; tiers: Tier[]; moq: number };

function tierFor(tiers: Tier[], qty: number): Tier | null {
  return [...tiers].sort((a, b) => b.min - a.min).find((t) => qty >= t.min) ?? null;
}

export function StoreFront({ slug, products, wholesale, tiers, moq }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sizes, setSizes] = useState<Record<string, Record<string, number>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setQty = (pid: string, size: string, n: number) =>
    setSizes((s) => ({ ...s, [pid]: { ...(s[pid] ?? {}), [size]: Math.max(0, Math.floor(n) || 0) } }));

  async function buy(p: StoreProduct) {
    setError(null);
    const chosen = Object.fromEntries(Object.entries(sizes[p.id] ?? {}).filter(([, n]) => n > 0));
    const qty = Object.values(chosen).reduce((a, b) => a + b, 0);
    if (!qty) { setError("Pick at least one size."); return; }
    if (wholesale && moq && qty < moq) { setError(`Wholesale minimum is ${moq} pieces per product.`); return; }
    if (!name.trim() || !email.includes("@")) { setError("Name and email, please."); return; }
    setBusy(p.id);
    try {
      const r = await fetch(`/api/stores/${encodeURIComponent(slug)}/orders`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ product_id: p.id, sizes: chosen, name: name.trim(), email: email.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as { checkout_url?: string; error?: string };
      if (!r.ok || !j.checkout_url) throw new Error(j.error ?? String(r.status));
      window.location.assign(j.checkout_url);
    } catch (e) {
      setError(`Couldn't start checkout (${(e as Error).message}).`);
      setBusy(null);
    }
  }

  if (!products.length) {
    return <div className="panel mt-8 p-8 text-center text-sm text-mf-muted">Nothing on the rack yet. Check back soon.</div>;
  }

  return (
    <div className="mt-6">
      <div className="panel grid gap-3 p-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="buyer-name">Name</label>
          <input id="buyer-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="buyer-email">Email</label>
          <input id="buyer-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-[color:var(--mf-bad)]">{error}</p>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const picked = sizes[p.id] ?? {};
          const qty = Object.values(picked).reduce((a, b) => a + b, 0);
          const tier = wholesale ? tierFor(tiers, qty) : null;
          const unit = tier ? p.price * (1 - tier.pct) : p.price;
          return (
            <div key={p.id} className="panel flex flex-col p-3">
              <div className="flex aspect-square items-center justify-center bg-mf-bg">
                {p.image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.image} alt={p.title} className="max-h-full max-w-full object-contain" />
                  : <span className="text-xs uppercase tracking-widest text-mf-dim">Mockup coming</span>}
              </div>
              <h2 className="mt-3 text-lg text-mf-cream">{p.title}</h2>
              {p.blank && <p className="text-xs text-mf-dim">{p.blank}</p>}
              <p className="mt-1 font-mono text-mf-gold">
                ${unit.toFixed(2)}{tier && <span className="ml-2 text-xs text-mf-muted line-through">${p.price.toFixed(2)}</span>}
                {tier && <span className="ml-2 text-xs text-mf-muted">{Math.round(tier.pct * 100)}% tier</span>}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {p.sizes.map((s) => (
                  <label key={s} className="flex items-center gap-1 border border-mf-line px-1.5 py-1 text-xs">
                    <span className="w-8 font-mono text-mf-muted">{s}</span>
                    <input type="number" min={0} inputMode="numeric" value={picked[s] ?? ""} placeholder="0"
                      onChange={(e) => setQty(p.id, s, Number(e.target.value))} className="w-full bg-transparent text-right text-mf-cream outline-none" aria-label={`${p.title} size ${s}`} />
                  </label>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-mf-muted">{qty} pcs · <span className="font-mono text-mf-cream">${(unit * qty).toFixed(2)}</span></span>
                <button className="btn btn-solid" onClick={() => buy(p)} disabled={busy !== null}>{busy === p.id ? "Opening…" : "Buy"}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
