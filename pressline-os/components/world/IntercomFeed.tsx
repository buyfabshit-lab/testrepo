"use client";
import { useEffect, useState } from "react";
import { parseIntercom, timeAgo, type IntercomLine } from "./intercom";

const POLL_MS = 30_000;

/** Intercom room: Outlaw's last 20 lines (server-seeded, refreshed every 30s) + an "ask Outlaw" box → POST /api/outlaw/chat. */
export default function IntercomFeed({ initial }: { initial: IntercomLine[] }) {
  const [lines, setLines] = useState<IntercomLine[]>(initial);
  const [refreshed, setRefreshed] = useState<Date | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const load = async () => {
      try {
        const res = await fetch("/api/outlaw/intercom?limit=20", { cache: "no-store", signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const parsed = parseIntercom(await res.json());
        if (!alive) return;
        if (parsed.length) setLines(parsed);
        setRefreshed(new Date());
        setStale(false);
      } catch {
        if (alive) setStale(true);
      }
    };
    const t = setInterval(load, POLL_MS);
    void load();
    return () => { alive = false; ctrl.abort(); clearInterval(t); };
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="panel">
        <div className="flex items-center justify-between border-b border-mf-line px-4 py-3">
          <h2 className="text-lg text-mf-gold">Outlaw broadcast</h2>
          <span className="text-[10px] uppercase tracking-[.14em] text-mf-dim">
            {stale ? "line static — showing last known" : refreshed ? `refreshed ${timeAgo(refreshed.toISOString())}` : "refreshes every 30s"}
          </span>
        </div>
        {lines.length === 0 ? (
          <p className="px-4 py-8 text-sm text-mf-muted">Quiet on the horn. Outlaw speaks when the nightly run goes, a rush comes in, or a drop lands.</p>
        ) : (
          <ol className="divide-y divide-mf-line">
            {lines.map((l) => (
              <li key={l.id} className="px-4 py-3">
                <p className="text-sm text-mf-cream">{l.msg}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[.14em] text-mf-dim">
                  {l.kind ?? "outlaw"}{l.ts ? ` · ${timeAgo(l.ts)}` : ""}{l.orderId ? " · order" : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
      <AskOutlaw />
    </div>
  );
}

type Turn = { role: "user" | "assistant"; content: string };

function AskOutlaw() {
  const [history, setHistory] = useState<Turn[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true); setErr(null); setMessage("");
    const next: Turn[] = [...history, { role: "user", content: text }];
    setHistory(next);
    try {
      const res = await fetch("/api/outlaw/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, history: history.slice(-10) }),
      });
      const body = (await res.json().catch(() => null)) as { text?: string; error?: string } | null;
      if (!res.ok) {
        setErr(res.status === 401 || res.status === 403 ? "Outlaw only talks to staff on this line. Sign in to the dashboard first." : body?.error ?? `Outlaw didn't answer (${res.status}).`);
        return;
      }
      setHistory([...next, { role: "assistant", content: body?.text ?? "…" }]);
    } catch {
      setErr("Line dropped.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel flex flex-col">
      <h2 className="border-b border-mf-line px-4 py-3 text-lg text-mf-gold">Ask Outlaw</h2>
      <div className="flex-1 space-y-3 px-4 py-3 text-sm" aria-live="polite">
        {history.length === 0 && <p className="text-mf-muted">Push to talk. Outlaw answers from the log — if the data doesn&apos;t say it, he won&apos;t either.</p>}
        {history.map((t, i) => (
          <p key={i} className={t.role === "user" ? "text-mf-cream" : "border-l-2 border-mf-gold pl-3 text-mf-muted"}>
            <span className="mr-2 text-[10px] uppercase tracking-[.14em] text-mf-dim">{t.role === "user" ? "you" : "outlaw"}</span>{t.content}
          </p>
        ))}
        {err && <p className="text-xs text-[#dc2626]">{err}</p>}
      </div>
      <form className="flex gap-2 border-t border-mf-line p-3" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input className="input" placeholder="What's on the gang sheet tonight?" value={message} onChange={(e) => setMessage(e.target.value)} aria-label="Message to Outlaw" />
        <button type="submit" className="btn btn-solid shrink-0" disabled={busy || !message.trim()}>{busy ? "…" : "Send"}</button>
      </form>
    </section>
  );
}
