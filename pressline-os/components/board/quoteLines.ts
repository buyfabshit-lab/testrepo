/** Quote `lines` is JSON; this is the shape POST /api/quotes stores (priced line + blank snapshot). */
export type StoredQuoteLine = {
  blank_id?: string | null; blank_cost?: number; method?: string; sizes?: Record<string, number>; qty?: number;
  locations?: string[]; colors?: number; label?: string; unit?: number; setup?: number; line?: number;
  blank?: { id: string; cost: number | null; style: string | null; brand: string | null; color: string | null } | null;
};

export function quoteLines(json: unknown): StoredQuoteLine[] {
  return Array.isArray(json) ? (json as StoredQuoteLine[]) : [];
}

export function lineTitle(l: StoredQuoteLine): string {
  if (l.label) return l.label;
  if (l.blank) return `${l.blank.brand ?? ""} ${l.blank.style ?? ""} ${l.blank.color ?? ""}`.trim() || "Blank";
  return "Blank";
}
