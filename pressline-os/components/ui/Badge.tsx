import { STATUS_COLORS, STATUS_LABELS, isOrderStatus } from "@/lib/orders/status";

export function StatusBadge({ status, className = "" }: { status: string | null | undefined; className?: string }) {
  if (!isOrderStatus(status)) return <span className={`badge bg-mf-line text-mf-muted ${className}`}>{status ?? "—"}</span>;
  const c = STATUS_COLORS[status];
  return (
    <span className={`badge ${className}`} style={{ background: c.hex, color: c.text }}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export type Tone = "gold" | "muted" | "ok" | "warn" | "bad" | "blood";
const TONES: Record<Tone, string> = {
  gold: "bg-mf-gold text-mf-bg",
  muted: "bg-mf-line text-mf-cream",
  ok: "bg-green-700 text-white",
  warn: "bg-yellow-500 text-black",
  bad: "bg-red-700 text-white",
  blood: "bg-mf-blood text-mf-cream",
};
export function Badge({ children, tone = "muted", className = "" }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return <span className={`badge ${TONES[tone]} ${className}`}>{children}</span>;
}

export function YesNo({ value }: { value: boolean | null | undefined }) {
  return value ? <Badge tone="ok">Yes</Badge> : <Badge tone="muted">No</Badge>;
}

/** SMS consent state: opted out beats consent. */
export function SmsConsent({ c }: { c: { sms_consent_at: string | null; sms_opted_out_at: string | null } }) {
  if (c.sms_opted_out_at) return <Badge tone="bad">Opted out</Badge>;
  if (c.sms_consent_at) return <Badge tone="ok">Yes</Badge>;
  return <Badge tone="muted">No</Badge>;
}
