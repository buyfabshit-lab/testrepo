"use client";
import { useState } from "react";

/** Per-product checkout: sizes + name + email → POST /api/stores/:slug/orders → Stripe Checkout. */
const SIZES = ["S", "M", "L", "XL", "2XL"] as const;

type OrderResponse = { checkout_url?: string | null; store_order_id?: string; note?: string; error?: string } | null;

export default function BuyBox({ storeSlug, productId }: { storeSlug: string; productId: string }) {
  const [open, setOpen] = useState(false);
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const qty = Object.values(sizes).reduce((a, b) => a + b, 0);

  const submit = async () => {
    if (!qty || !name.trim() || !email.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      const picked = Object.fromEntries(Object.entries(sizes).filter(([, n]) => n > 0));
      const res = await fetch(`/api/stores/${encodeURIComponent(storeSlug)}/orders`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ product_id: productId, sizes: picked, name: name.trim(), email: email.trim() }),
      });
      const body = (await res.json().catch(() => null)) as OrderResponse;
      if (!res.ok) { setErr(body?.error ?? `Register's jammed (${res.status}).`); return; }
      if (!body?.checkout_url) {
        // The route records the store order and returns checkout_url: null when Stripe isn't configured.
        setErr(body?.note ? `Order noted, but the register can't take cards yet (${body.note}).` : "Order noted, but no checkout link came back.");
        return;
      }
      window.location.assign(body.checkout_url);
    } catch {
      setErr("Register's offline.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return <button type="button" className="btn w-full justify-center" onClick={() => setOpen(true)}>Buy</button>;
  return (
    <form className="space-y-2 border-t border-mf-line pt-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <div className="grid grid-cols-5 gap-1">
        {SIZES.map((s) => (
          <label key={s} className="text-center">
            <span className="label mb-0.5">{s}</span>
            <input type="number" min={0} max={99} inputMode="numeric" className="input px-1 text-center" value={sizes[s] ?? ""} aria-label={`Quantity ${s}`}
              onChange={(e) => setSizes({ ...sizes, [s]: Math.max(0, Math.min(99, Number(e.target.value) || 0)) })} />
          </label>
        ))}
      </div>
      <input className="input" placeholder="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" required />
      <input className="input" type="email" placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" required />
      {err && <p className="text-xs text-[#dc2626]">{err}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
        <button type="submit" className="btn btn-solid flex-1 justify-center" disabled={busy || !qty || !name.trim() || !email.trim()}>{busy ? "…" : `Checkout · ${qty}`}</button>
      </div>
    </form>
  );
}
