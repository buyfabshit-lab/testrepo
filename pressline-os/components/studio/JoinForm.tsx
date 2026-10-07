"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

const NICHES = ["moto", "surf", "skate", "bar", "gym", "team", "band", "other"] as const;

export function JoinForm({ consentText, referrer }: { consentText: string; referrer: string | null }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const str = (k: string) => String(fd.get(k) ?? "").trim();
    const phone = str("phone");
    if (smsConsent && !phone) { setError("Add a phone number to get texts, or untick the SMS box."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: str("name"),
          email: str("email"),
          phone: phone || null,
          company: str("company") || null,
          niche: str("niche") || null,
          website: str("website") || null,
          notes: str("notes") || null,
          source: "front_gate",
          referrer: referrer ?? undefined,
          email_opt_in: emailOptIn,
          sms_consent: smsConsent,
          consent_text: smsConsent ? consentText : undefined,
        }),
      });
      if (!res.ok) throw new Error(`capture ${res.status}`);
      // The API returns a screen result. We never surface it to the customer.
      setDone(true);
    } catch {
      setError("Couldn't get through. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="py-6 text-center">
        <h2 className="text-3xl text-mf-gold">Outlaw&apos;s got your name.</h2>
        <p className="mt-3 text-sm text-mf-muted">You&apos;ll hear from us. Meanwhile, go make something.</p>
        <Link href="/design" className="btn btn-solid mt-6">Open the Design Studio</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" name="name" required className="input" autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="input" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone (optional)</label>
          <input id="phone" name="phone" type="tel" className="input" autoComplete="tel" placeholder="+1" />
        </div>
        <div>
          <label className="label" htmlFor="company">Company / shop (optional)</label>
          <input id="company" name="company" className="input" autoComplete="organization" />
        </div>
        <div>
          <label className="label" htmlFor="niche">Scene</label>
          <select id="niche" name="niche" className="input" defaultValue="">
            <option value="" disabled>Pick one</option>
            {NICHES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="website">Website / IG (optional)</label>
          <input id="website" name="website" className="input" placeholder="https://" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="notes">What are you making?</label>
        <textarea id="notes" name="notes" rows={4} className="input" placeholder="50 black tees, front + back, need them by the 20th…" />
      </div>

      <label className="flex items-start gap-3 text-sm text-mf-cream">
        <input type="checkbox" className="mt-1 accent-mf-gold" checked={emailOptIn} onChange={(e) => setEmailOptIn(e.target.checked)} />
        <span>Email me drops, deals, and shop news from Midnight Fusion. Unsubscribe any time.</span>
      </label>
      <label className="flex items-start gap-3 text-sm text-mf-cream">
        <input type="checkbox" className="mt-1 accent-mf-gold" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} />
        <span className="text-mf-muted">{consentText}</span>
      </label>

      {error && <p className="text-sm text-[color:var(--mf-bad)]">{error}</p>}
      <div className="flex items-center gap-4">
        <button type="submit" className="btn btn-solid" disabled={busy}>{busy ? "Sending…" : "Send it"}</button>
        <span className="text-xs text-mf-dim">No spam. No texts unless you tick the box.</span>
      </div>
    </form>
  );
}
