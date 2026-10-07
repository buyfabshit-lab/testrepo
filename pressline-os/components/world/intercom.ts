/** Shared (client + server) shape for Outlaw's intercom lines, plus a tolerant parser for GET /api/outlaw/intercom. */
export interface IntercomLine {
  id: string;
  msg: string;
  kind: string | null;
  ts: string | null;
  orderId: string | null;
}

type Loose = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v.length ? v : typeof v === "number" ? String(v) : null);

/** Accepts `{ messages }` (the live route), `{ lines }`, `{ events }`, `{ items }` or a bare array; each item may use msg/text/message and ts/at/created_at. */
export function parseIntercom(payload: unknown): IntercomLine[] {
  const p = payload as Loose | unknown[] | null;
  const arr: unknown[] = Array.isArray(p) ? p
    : p && typeof p === "object"
      ? ((p.messages ?? p.lines ?? p.events ?? p.items ?? p.data) as unknown[] | undefined) ?? []
      : [];
  return arr.flatMap((raw, i) => {
    if (!raw || typeof raw !== "object") return [];
    const r = raw as Loose;
    const msg = str(r.msg) ?? str(r.text) ?? str(r.message);
    if (!msg) return [];
    return [{
      id: str(r.id) ?? `line-${i}`,
      msg,
      kind: str(r.kind),
      ts: str(r.ts) ?? str(r.at) ?? str(r.created_at),
      orderId: str(r.order_id) ?? str(r.orderId),
    }];
  });
}

export function timeAgo(ts: string | null, now = Date.now()): string {
  if (!ts) return "";
  const d = new Date(ts).getTime();
  if (!Number.isFinite(d)) return "";
  const s = Math.max(0, Math.round((now - d) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
