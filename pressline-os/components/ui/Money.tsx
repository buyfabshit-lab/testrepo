import { money } from "./format";

export function Money({ value, className = "" }: { value: number | string | null | undefined; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{money(value)}</span>;
}
