"use client";

import { useState } from "react";

type Props = {
  token: string;
  approved: boolean;
  paid: boolean;
  total: number;
  phone: string | null;
  smsConsented: boolean;
  consentText: string;
};

export function ProofActions({ token, approved, paid, total, phone, smsConsented, consentText }: Props) {
  const [busy, setBusy] = useState<"approve" | "change" | "sms" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [changeSent, setChangeSent] = useState(false);
  const [smsChecked, setSmsChecked] = useState(false);
  const [smsDone, setSmsDone] = useState(smsConsented);

  async function post(path: string, body?: unknown) {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `${res.status}`);
    return json;
  }

  async function approve() {
    setError(null); setBusy("approve");
    try {
      const json = await post(`/api/proof/${encodeURIComponent(token)}/approve`);
      const url = json.checkout_url;
      if (typeof url === "string" && url) { window.location.assign(url); return; }
      throw new Error("no checkout url");
    } catch (e) {
      setError(`Couldn't start checkout (${(e as Error).message}). Try again or reply to the proof email.`);
      setBusy(null);
    }
  }

  async function requestChange() {
    if (!comment.trim()) { setError("Tell us what to change."); return; }
    setError(null); setBusy("change");
    try {
      await post(`/api/proof/${encodeURIComponent(token)}/request-change`, { comment: comment.trim() });
      setChangeSent(true); setChangeOpen(false);
    } catch (e) {
      setError(`Couldn't send that (${(e as Error).message}).`);
    } finally { setBusy(null); }
  }

  async function optIn(checked: boolean) {
    setSmsChecked(checked);
    if (!checked || !phone) return;
    setBusy("sms");
    try {
      await post("/api/sms/opt-in", { phone, consent: true, consent_text: consentText, source: "proof" });
      setSmsDone(true);
    } catch {
      setSmsChecked(false);
      setError("Couldn't save text consent right now.");
    } finally { setBusy(null); }
  }

  return (
    <div className="mt-6 grid gap-4">
      {approved ? (
        <div className="panel border-[color:var(--mf-gold)] p-4">
          <p className="font-display text-lg uppercase text-mf-gold">Approved &amp; locked</p>
          <p className="mt-1 text-sm text-mf-muted">Changes need a new revision — reply to your proof email and we&apos;ll cut one.</p>
          {!paid && (
            <button className="btn btn-solid mt-4" onClick={approve} disabled={busy === "approve"}>
              {busy === "approve" ? "Opening checkout…" : `Pay $${total.toFixed(2)}`}
            </button>
          )}
        </div>
      ) : (
        <div className="panel p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-solid" onClick={approve} disabled={busy !== null}>
              {busy === "approve" ? "Opening checkout…" : `Approve & pay $${total.toFixed(2)}`}
            </button>
            <button className="btn" onClick={() => setChangeOpen((v) => !v)} disabled={busy !== null}>Request change</button>
          </div>
          <p className="mt-2 text-xs text-mf-dim">Approving locks the art and opens secure checkout. Check spelling, sizes, and placement first.</p>
          {changeOpen && (
            <div className="mt-4">
              <label className="label" htmlFor="change">What should we change?</label>
              <textarea id="change" rows={4} className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Move the logo up an inch, make the back print bigger, swap to a navy tee…" />
              <button className="btn btn-blood mt-3" onClick={requestChange} disabled={busy === "change"}>{busy === "change" ? "Sending…" : "Send change request"}</button>
            </div>
          )}
          {changeSent && <p className="mt-3 text-sm text-mf-gold">Got it. Justin&apos;s been pinged — a fresh proof lands in your inbox.</p>}
        </div>
      )}

      {phone && (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 accent-mf-gold" checked={smsDone || smsChecked} disabled={smsDone || busy === "sms"} onChange={(e) => optIn(e.target.checked)} />
          <span className="text-mf-muted">
            {smsDone && <span className="mr-2 text-mf-gold">Texts on.</span>}
            {consentText}
          </span>
        </label>
      )}

      {error && <p className="text-sm text-[color:var(--mf-bad)]">{error}</p>}
    </div>
  );
}
