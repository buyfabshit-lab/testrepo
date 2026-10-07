/** Formatting helpers shared by the dashboard. Money is USD; dates are America/Los_Angeles. */
export const TZ = "America/Los_Angeles";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function money(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : n;
  if (v === null || v === undefined || Number.isNaN(v)) return "$0.00";
  return usd.format(v);
}

/** Timestamp (ISO) → "Oct 7, 3:42 PM" in LA. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
}

/** Timestamp (ISO) → "Oct 7, 2026" in LA. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", year: "numeric" }).format(d);
}

/** A date-only column (YYYY-MM-DD) → "Oct 7". No timezone shift: it is a calendar day. */
export function fmtDay(ymd: string | null | undefined, withYear = false): string {
  if (!ymd) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) }).format(dt);
}

/** Today's calendar day in LA as YYYY-MM-DD. */
export function todayLA(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const CLOSED = new Set(["SHIPPED", "DONE", "CANCELLED"]);
export function isOverdue(due: string | null | undefined, status: string | null | undefined, today = todayLA()): boolean {
  if (!due) return false;
  if (status && CLOSED.has(status)) return false;
  return due.slice(0, 10) < today;
}

export function trackingUrl(carrier: string | null | undefined, tracking: string): string {
  const c = (carrier ?? "").toLowerCase();
  if (c.includes("ups")) return `https://www.ups.com/track?tracknum=${tracking}`;
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${tracking}`;
  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}`;
}

export const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
export function sizeKeys(sizes: Record<string, unknown> | null | undefined): string[] {
  const keys = Object.keys(sizes ?? {});
  return keys.sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.toUpperCase()), ib = SIZE_ORDER.indexOf(b.toUpperCase());
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}
export function sumSizes(sizes: unknown): number {
  if (!sizes || typeof sizes !== "object") return 0;
  return Object.values(sizes as Record<string, unknown>).reduce<number>((s, n) => s + (Number(n) || 0), 0);
}
