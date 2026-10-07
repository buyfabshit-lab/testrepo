"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/ui/api";
import { Button } from "@/components/ui/Button";

export type ShipTo = { name: string; company?: string | null; street1: string; street2?: string | null; city: string; state: string; postalCode: string; country?: string; phone?: string | null };

/** Buys a label through POST /api/shipments. Prefills from customers.address when we have one (Shopify orders, prior labels). */
export function LabelForm({ orderId, orderNumber, customer, onDone }: {
  orderId: string; orderNumber: number;
  customer: { name?: string | null; company?: string | null; phone?: string | null; address?: Partial<ShipTo> | null } | null;
  onDone?: (shipment: unknown) => void;
}) {
  const router = useRouter();
  const a = customer?.address ?? null;
  const [to, setTo] = useState<ShipTo>({ name: a?.name || customer?.name || "", company: a?.company ?? customer?.company ?? "", street1: a?.street1 ?? "", street2: a?.street2 ?? "", city: a?.city ?? "", state: a?.state || "CA", postalCode: a?.postalCode ?? "", phone: a?.phone ?? customer?.phone ?? "" });
  const [weight, setWeight] = useState(16);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ tracking?: string; label_url?: string } | null>(null);

  const set = (k: keyof ShipTo) => (e: React.ChangeEvent<HTMLInputElement>) => setTo((t) => ({ ...t, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await api<{ shipment: { tracking?: string | null }; label_url?: string | null; tracking_url?: string }>("/api/shipments", {
        body: { order_id: orderId, ship_to: to, weight_oz: Number(weight) },
      });
      setResult({ tracking: res.shipment?.tracking ?? undefined, label_url: res.label_url ?? undefined });
      onDone?.(res.shipment);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Label failed");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="border border-mf-gold p-3 text-sm">
        <p className="font-bold text-mf-gold">Label bought for #{orderNumber}.</p>
        {result.tracking ? <p className="mt-1">Tracking: <span className="font-mono">{result.tracking}</span></p> : null}
        {result.label_url ? <a href={result.label_url} target="_blank" rel="noreferrer" className="btn mt-2">Open label PDF</a> : null}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-2 text-sm">
      <label className="col-span-2"><span className="label">Ship to name</span><input className="input" required value={to.name} onChange={set("name")} /></label>
      <label className="col-span-2"><span className="label">Company</span><input className="input" value={to.company ?? ""} onChange={set("company")} /></label>
      <label className="col-span-2"><span className="label">Street</span><input className="input" required value={to.street1} onChange={set("street1")} autoComplete="street-address" /></label>
      <label className="col-span-2"><span className="label">Street 2</span><input className="input" value={to.street2 ?? ""} onChange={set("street2")} /></label>
      <label><span className="label">City</span><input className="input" required value={to.city} onChange={set("city")} /></label>
      <label><span className="label">State</span><input className="input" required maxLength={2} value={to.state} onChange={set("state")} /></label>
      <label><span className="label">ZIP</span><input className="input" required inputMode="numeric" value={to.postalCode} onChange={set("postalCode")} /></label>
      <label><span className="label">Phone</span><input className="input" inputMode="tel" value={to.phone ?? ""} onChange={set("phone")} /></label>
      <label><span className="label">Weight (oz)</span><input className="input" type="number" min={1} step={1} required value={weight} onChange={(e) => setWeight(Number(e.target.value))} /></label>
      <div className="col-span-2 flex items-end justify-end">
        <Button type="submit" variant="solid" loading={busy}>Create label</Button>
      </div>
      {error ? <p className="col-span-2 text-red-400">{error}</p> : null}
    </form>
  );
}
