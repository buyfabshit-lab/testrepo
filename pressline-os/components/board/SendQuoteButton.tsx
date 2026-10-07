"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/ui/api";
import { Button } from "@/components/ui/Button";

export function SendQuoteButton({ quoteId, existingProofToken }: { quoteId: string; existingProofToken: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(existingProofToken ? `/proof/${existingProofToken}` : null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true); setError(null);
    try {
      const res = await api<{ ok: boolean; proof_url: string }>(`/api/quotes/${quoteId}/send`, { method: "POST", body: {} });
      setProofUrl(res.proof_url);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 text-sm">
      <Button variant="solid" className="w-full justify-center" loading={busy} onClick={send}>Send to customer</Button>
      <p className="text-xs text-mf-dim">Creates the order (NEW → QUOTED) with a proof link and emails it.</p>
      {proofUrl ? <p className="break-all">Proof: <a href={proofUrl} target="_blank" rel="noreferrer">{proofUrl}</a></p> : null}
      {error ? <p className="text-red-400">{error}</p> : null}
    </div>
  );
}
