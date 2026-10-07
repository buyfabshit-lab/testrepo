"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@/lib/orders/status";
import { api } from "@/components/ui/api";

/** One big button: move an order to a status (Jeff's "Mark packed"). */
export function MarkStatusButton({ orderId, to, label, className = "" }: { orderId: string; to: OrderStatus; label: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setBusy(true); setError(null);
    try {
      await api(`/api/orders/${orderId}/status`, { method: "PATCH", body: { status: to } });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }
  return (
    <div className={className}>
      <button type="button" onClick={go} disabled={busy} className="btn btn-solid w-full justify-center !py-4 !text-base">{busy ? "…" : label}</button>
      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
