"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OfficePo, OfficeQuote } from "./data";

/**
 * Business Office PIN wall tablet. Keypad → POST /api/office/pin { pin }.
 * On 200 the server has set the httpOnly `pl_office` cookie, so we refresh and the
 * server page re-renders with `unlocked` + the desk data. 423/429 → lockout message.
 */
type Props = { unlocked: boolean; quotes: OfficeQuote[]; pos: OfficePo[] };

const MIN = 4, MAX = 6;

function minutesLeft(res: Response, body: Record<string, unknown> | null): number | null {
  const until = body?.locked_until ?? body?.lockedUntil ?? body?.until;
  if (typeof until === "string") {
    const ms = new Date(until).getTime() - Date.now();
    if (Number.isFinite(ms)) return Math.max(1, Math.ceil(ms / 60_000));
  }
  for (const k of ["minutes", "minutes_remaining", "retry_after_minutes"]) {
    const v = body?.[k];
    if (typeof v === "number") return Math.max(1, Math.ceil(v));
  }
  const sec = Number(res.headers.get("retry-after"));
  if (Number.isFinite(sec) && sec > 0) return Math.max(1, Math.ceil(sec / 60));
  const ra = body?.retry_after;
  if (typeof ra === "number") return Math.max(1, Math.ceil(ra / 60));
  return null;
}

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  try { return (await res.json()) as Record<string, unknown>; } catch { return null; }
}

function Keypad() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "bad" | "warn" | "ok"; text: string } | null>(null);

  const press = (d: string) => { if (pin.length < MAX && !busy) { setPin(pin + d); setMsg(null); } };
  const submit = async () => {
    if (pin.length < MIN || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/office/pin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }) });
      if (res.ok) {
        setMsg({ tone: "ok", text: "Door's open." });
        router.refresh();
        return;
      }
      const body = await readJson(res);
      if (res.status === 423 || res.status === 429) {
        const m = minutesLeft(res, body);
        setMsg({ tone: "bad", text: `Locked out.${m ? ` Try again in ${m} minute${m === 1 ? "" : "s"}.` : " Try again later."}` });
      } else {
        const left = body?.remaining ?? body?.attempts_left;
        setMsg({ tone: "warn", text: typeof left === "number" ? `Wrong PIN. ${left} attempt${left === 1 ? "" : "s"} left.` : "Wrong PIN." });
      }
      setPin("");
    } catch {
      setMsg({ tone: "bad", text: "Tablet can't reach the office line." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel mx-auto w-full max-w-xs p-5">
      <p className="label text-center">Wall tablet · enter PIN</p>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div className="my-4 flex justify-center gap-2" aria-live="polite" aria-label={`${pin.length} digits entered`}>
          {Array.from({ length: MAX }, (_, i) => (
            <span key={i} className={`h-3 w-3 rounded-full border ${i < pin.length ? "border-mf-gold bg-mf-gold" : i < MIN ? "border-mf-muted" : "border-mf-line"}`} />
          ))}
        </div>
        <input type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" aria-label="PIN" className="input text-center tracking-[.5em]"
          value={pin} maxLength={MAX} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, MAX))} />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} type="button" onClick={() => press(d)} className="btn justify-center py-3 text-base">{d}</button>
          ))}
          <button type="button" onClick={() => setPin(pin.slice(0, -1))} className="btn justify-center py-3" aria-label="Delete">⌫</button>
          <button type="button" onClick={() => press("0")} className="btn justify-center py-3 text-base">0</button>
          <button type="submit" disabled={pin.length < MIN || busy} className="btn btn-solid justify-center py-3" aria-label="Enter">↵</button>
        </div>
      </form>
      <p className={`mt-3 min-h-5 text-center text-xs ${msg?.tone === "bad" ? "text-[#dc2626]" : msg?.tone === "warn" ? "text-[#eab308]" : msg?.tone === "ok" ? "text-[#16a34a]" : "text-mf-dim"}`} role="status">
        {msg?.text ?? `${MIN}–${MAX} digits. Three misses locks the wall for 15 minutes.`}
      </p>
    </div>
  );
}

type RowState = { busy: boolean; note?: string; done?: boolean };

function Desk({ quotes, pos }: { quotes: OfficeQuote[]; pos: OfficePo[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const set = (id: string, s: RowState) => setRows((r) => ({ ...r, [id]: s }));

  const act = async (id: string, url: string, okText: (b: Record<string, unknown> | null) => string) => {
    set(id, { busy: true });
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" } });
      const body = await readJson(res);
      if (res.status === 401 || res.status === 403) { set(id, { busy: false, note: "Approvals are signed by the owner session. The PIN opens the door; sign in to the dashboard on this device to tap approve." }); return; }
      if (!res.ok) { set(id, { busy: false, note: typeof body?.error === "string" ? body.error : `Refused (${res.status}).` }); return; }
      set(id, { busy: false, done: true, note: okText(body) });
      router.refresh();
    } catch {
      set(id, { busy: false, note: "Line dropped. Try again." });
    }
  };

  const money = (n: number | null) => (typeof n === "number" ? `$${n.toFixed(2)}` : "—");
  const when = (ts: string | null) => (ts ? new Date(ts).toLocaleDateString() : "");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="panel">
        <h2 className="border-b border-mf-line px-4 py-3 text-lg text-mf-gold">Quotes waiting on a yes <span className="ml-2 text-sm text-mf-muted">{quotes.length}</span></h2>
        {quotes.length === 0 ? <p className="px-4 py-6 text-sm text-mf-muted">Nothing sent and unanswered.</p> : (
          <ul className="divide-y divide-mf-line">
            {quotes.map((q) => {
              const s = rows[q.id] ?? { busy: false };
              return (
                <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-mono text-sm">Q-{q.id.slice(0, 8)} <span className="text-mf-muted">· {q.lineCount} line{q.lineCount === 1 ? "" : "s"} · {when(q.created_at)}</span></p>
                    <p className="text-lg text-mf-cream">{money(q.total)}</p>
                    {s.note && <p className={`text-xs ${s.done ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{s.note}</p>}
                  </div>
                  <button type="button" disabled={s.busy || s.done} className="btn btn-solid"
                    onClick={() => void act(q.id, `/api/quotes/${q.id}/approve`, () => "Approved. Order moves to APPROVED.")}>
                    {s.done ? "Approved" : s.busy ? "…" : "Approve"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="panel">
        <h2 className="border-b border-mf-line px-4 py-3 text-lg text-mf-gold">Purchase orders pending <span className="ml-2 text-sm text-mf-muted">{pos.length}</span></h2>
        {pos.length === 0 ? <p className="px-4 py-6 text-sm text-mf-muted">No POs waiting on approval.</p> : (
          <ul className="divide-y divide-mf-line">
            {pos.map((p) => {
              const s = rows[p.id] ?? { busy: false };
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-mono text-sm">PO-{p.id.slice(0, 8)} <span className="text-mf-muted">· {(p.supplier ?? "supplier").toUpperCase()} · {p.lineCount} line{p.lineCount === 1 ? "" : "s"}{p.orderNumber ? ` · order #${p.orderNumber}` : ""}</span></p>
                    <p className="text-xs text-mf-dim">{when(p.created_at)} · places with the supplier only when LIVE_MONEY is on, otherwise dry run</p>
                    {s.note && <p className={`text-xs ${s.done ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{s.note}</p>}
                  </div>
                  <button type="button" disabled={s.busy || s.done} className="btn btn-blood"
                    onClick={() => void act(p.id, `/api/po/${p.id}/approve`, (b) => (b?.dry_run ? "Approved (dry run — LIVE_MONEY is off)." : "Approved and placed."))}>
                    {s.done ? "Approved" : s.busy ? "…" : "Approve PO"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function PinWall({ unlocked, quotes, pos }: Props) {
  if (!unlocked) return <Keypad />;
  return <Desk quotes={quotes} pos={pos} />;
}
