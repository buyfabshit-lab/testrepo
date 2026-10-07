"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@/lib/orders/status";
import { api } from "@/components/ui/api";
import { Button } from "@/components/ui/Button";
import { StatusSelect } from "@/components/ui/StatusSelect";
import { Toast, type ToastState } from "@/components/ui/Toast";
import { LabelForm } from "./LabelForm";

export type PoLine = { identifier: string; qty: number };

export function OrderActions({ orderId, orderNumber, status, proofToken, customer, poLines, hasPo }: {
  orderId: string; orderNumber: number; status: OrderStatus; proofToken: string | null;
  customer: { name?: string | null; company?: string | null; phone?: string | null } | null;
  poLines: PoLine[]; hasPo: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [showLabel, setShowLabel] = useState(false);

  async function run(name: string, fn: () => Promise<string>) {
    setBusy(name);
    try {
      setToast({ kind: "ok", text: await fn() });
      router.refresh();
    } catch (err) {
      setToast({ kind: "err", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setBusy(null);
    }
  }

  const changeStatus = (s: OrderStatus) => run("status", async () => {
    await api(`/api/orders/${orderId}/status`, { method: "PATCH", body: { status: s, force: true } });
    return `#${orderNumber} → ${s}`;
  });

  const createPo = () => run("po", async () => {
    if (!poLines.length) throw new Error("No lines with a supplier style on this order");
    const res = await api<{ po?: { id?: string; status?: string } }>("/api/po", {
      body: { order_id: orderId, supplier: "ss", lines: poLines },
    });
    return `PO created (${res.po?.status ?? "pending_approval"}) — approve it under Suppliers`;
  });

  const copyProof = async () => {
    if (!proofToken) { setToast({ kind: "err", text: "No proof token yet — send the quote first" }); return; }
    const url = `${window.location.origin}/proof/${proofToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast({ kind: "ok", text: "Proof link copied" });
    } catch {
      window.prompt("Copy the proof link", url);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor="status">Status</label>
        <StatusSelect id="status" value={status} onChange={changeStatus} disabled={busy === "status"} />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button onClick={createPo} loading={busy === "po"} className="justify-center">{hasPo ? "Create another PO" : "Create PO"}</Button>
        <Button onClick={() => setShowLabel((v) => !v)} className="justify-center">{showLabel ? "Hide label form" : "Create label"}</Button>
        <Button onClick={copyProof} className="justify-center" disabled={!proofToken}>Send proof link</Button>
      </div>
      {showLabel ? (
        <div className="border border-mf-line p-3">
          <LabelForm orderId={orderId} orderNumber={orderNumber} customer={customer} onDone={() => setShowLabel(false)} />
        </div>
      ) : null}
      {proofToken ? <p className="break-all text-xs text-mf-dim">/proof/{proofToken}</p> : null}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
