"use client";
import { ORDER_STATUSES, STATUS_COLORS, STATUS_LABELS, type OrderStatus } from "@/lib/orders/status";

export function StatusSelect({ value, onChange, disabled, className = "", id }: {
  value: OrderStatus | null | undefined; onChange: (s: OrderStatus) => void; disabled?: boolean; className?: string; id?: string;
}) {
  const c = value ? STATUS_COLORS[value] : null;
  return (
    <select
      id={id}
      className={`input font-bold uppercase tracking-widest ${className}`}
      style={c ? { borderColor: c.hex, color: c.hex } : undefined}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as OrderStatus)}
    >
      {ORDER_STATUSES.map((s) => (
        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
      ))}
    </select>
  );
}
