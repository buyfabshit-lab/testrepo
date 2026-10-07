"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductRow, StoreRow } from "@/lib/supabase/types";
import { createPopupStore, type NewStoreState } from "@/app/(dashboard)/app/stores/actions";
import { api } from "@/components/ui/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { Thumb } from "@/components/ui/Thumb";
import { fmtDateTime } from "@/components/ui/format";
import { Toast, type ToastState } from "@/components/ui/Toast";

type Product = ProductRow & { blank: { style: string | null; brand: string | null; color: string | null } | null };
type Store = StoreRow & { products: Product[] | null };
const TARGETS = ["shopify", "skrewu", "stripe", "wholesale"] as const;

export function StoreCard({ store, paidOrders, isOwner }: { store: Store; paidOrders: number; isOwner: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  async function publish(productId: string, target: (typeof TARGETS)[number]) {
    setBusy(`${productId}:${target}`);
    try {
      const r = await api<{ published?: Record<string, unknown> }>(`/api/publish/${productId}`, { body: { targets: [target] } });
      setToast({ kind: "ok", text: `Published to ${target}${r.published?.[target] ? ` → ${String(r.published[target]).slice(0, 60)}` : ""}` });
      router.refresh();
    } catch (err) { setToast({ kind: "err", text: err instanceof Error ? err.message : "Publish failed" }); }
    finally { setBusy(null); }
  }
  async function close() {
    if (!window.confirm(`Close "${store.name}" and roll ${paidOrders} paid order(s) into one production order?`)) return;
    setBusy("close");
    try {
      const r = await api<{ order?: { id: string; number: number } }>(`/api/stores/${store.id}/close`, { method: "POST", body: {} });
      setToast({ kind: "ok", text: r.order ? `Rolled into order #${r.order.number}` : "Store closed" });
      router.refresh();
    } catch (err) { setToast({ kind: "err", text: err instanceof Error ? err.message : "Close failed" }); }
    finally { setBusy(null); }
  }

  const published = (p: Product) => (p.published && typeof p.published === "object" && !Array.isArray(p.published) ? (p.published as Record<string, unknown>) : {});

  return (
    <Card title={store.name ?? store.slug ?? "Store"}
      action={<span className="flex flex-wrap gap-1"><Badge tone="gold">{store.type ?? "?"}</Badge>{store.closed_order_id ? <Badge tone="muted">closed</Badge> : null}</span>}>
      <p className="text-xs text-mf-muted">
        {store.slug ? <Link href={`/s/${store.slug}`} target="_blank">/s/{store.slug}</Link> : null}
        {store.world_room ? <span className="ml-2">room · {store.world_room}</span> : null}
        <span className="ml-2">opens {fmtDateTime(store.opens_at)} · closes {fmtDateTime(store.closes_at)}</span>
        {store.fundraising_pct ? <span className="ml-2">· {store.fundraising_pct}% fundraising</span> : null}
        <span className="ml-2">· {paidOrders} paid</span>
      </p>
      <ul className="mt-3 divide-y divide-mf-line">
        {!store.products?.length ? <li className="py-3 text-sm text-mf-dim">No products in this store.</li> : null}
        {store.products?.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span className="flex items-center gap-2">
              <Thumb src={p.mockups?.[0]} className="h-10 w-10 object-cover" />
              <span><span className="font-bold">{p.title ?? "Untitled"}</span><span className="block text-xs text-mf-muted">{p.blank ? `${p.blank.brand ?? ""} ${p.blank.style ?? ""} ${p.blank.color ?? ""}` : ""} · <Money value={p.price} /></span></span>
            </span>
            <span className="flex flex-wrap gap-1">
              {TARGETS.map((t) => {
                const done = Boolean(published(p)[t]);
                return (
                  <button key={t} type="button" disabled={!isOwner || busy === `${p.id}:${t}`} onClick={() => publish(p.id, t)}
                    className={`badge border ${done ? "border-mf-gold bg-mf-gold text-mf-bg" : "border-mf-line text-mf-muted hover:border-mf-gold hover:text-mf-gold"} disabled:opacity-50`} title={done ? `Re-publish to ${t}` : `Publish to ${t}`}>
                    {t}
                  </button>
                );
              })}
            </span>
          </li>
        ))}
      </ul>
      {store.type === "popup" && !store.closed_order_id && isOwner ? (
        <Button variant="blood" className="mt-3" loading={busy === "close"} onClick={close}>Close store → roll into one order</Button>
      ) : null}
      {store.closed_order_id ? <p className="mt-3 text-sm"><Link href={`/app/orders/${store.closed_order_id}`}>Rolled-up production order →</Link></p> : null}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </Card>
  );
}

export function NewStoreForm() {
  const [state, action, pending] = useActionState<NewStoreState, FormData>(createPopupStore, {});
  return (
    <Card title="New pop-up store">
      <form action={action} className="space-y-3 text-sm">
        <label><span className="label">Name</span><input name="name" className="input" required placeholder="Death Squad Fall Drop" /></label>
        <label><span className="label">Slug</span><input name="slug" className="input" placeholder="auto from name" /></label>
        <label><span className="label">World room</span><input name="world_room" className="input" placeholder="clubhouse" /></label>
        <div className="grid grid-cols-2 gap-2">
          <label><span className="label">Opens</span><input name="opens_at" type="datetime-local" className="input" /></label>
          <label><span className="label">Closes</span><input name="closes_at" type="datetime-local" className="input" /></label>
        </div>
        <label><span className="label">Fundraising %</span><input name="fundraising_pct" type="number" min={0} max={100} step={1} defaultValue={0} className="input" /></label>
        {state.error ? <p className="text-red-400">{state.error}</p> : null}
        {state.ok ? <p className="text-mf-gold">Store created.</p> : null}
        <Button type="submit" variant="solid" className="w-full justify-center" loading={pending}>Open store</Button>
      </form>
    </Card>
  );
}
