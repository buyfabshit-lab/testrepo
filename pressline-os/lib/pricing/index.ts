/**
 * Quote pricing from price_rules (spec §7.1).
 *
 * unit = (blank cost + base + per_location*(locations-1) + per_color*colors) / (1 - margin)
 * line = unit * qty ; setup_fee once per line (screen/emb).
 */
export interface PriceRule {
  method: string; qty_min: number; qty_max: number;
  base: number; per_location: number; per_color: number; setup_fee: number; margin_pct: number;
}
export interface QuoteLineInput {
  method: "screen" | "dtf" | "emb" | "uv";
  qty: number;
  blankCost: number;
  locations: number;
  colors: number;
  rush?: boolean;
}
export interface QuoteLineResult extends QuoteLineInput {
  unit: number; setup: number; line: number; rule: PriceRule | null;
}

export const RUSH_MULTIPLIER = 1.25;

export function pickRule(rules: PriceRule[], method: string, qty: number): PriceRule | null {
  return rules.find((r) => r.method === method && qty >= r.qty_min && qty <= r.qty_max) ?? null;
}

export function priceLine(input: QuoteLineInput, rules: PriceRule[]): QuoteLineResult {
  const rule = pickRule(rules, input.method, input.qty);
  if (!rule) return { ...input, unit: 0, setup: 0, line: 0, rule: null };
  const extraLocations = Math.max(0, input.locations - 1);
  const cost = input.blankCost + Number(rule.base) + Number(rule.per_location) * extraLocations + Number(rule.per_color) * input.colors;
  const margin = Math.min(0.95, Math.max(0, Number(rule.margin_pct)));
  let unit = cost / (1 - margin);
  if (input.rush) unit *= RUSH_MULTIPLIER;
  unit = round2(unit);
  const setup = round2(Number(rule.setup_fee) * (input.method === "dtf" || input.method === "uv" ? 0 : 1));
  return { ...input, unit, setup, line: round2(unit * input.qty + setup), rule };
}

export function priceQuote(lines: QuoteLineInput[], rules: PriceRule[]) {
  const priced = lines.map((l) => priceLine(l, rules));
  const subtotal = round2(priced.reduce((s, l) => s + l.line, 0));
  return { lines: priced, subtotal, total: subtotal };
}

export function sumSizes(sizes: Record<string, number> | null | undefined): number {
  return Object.values(sizes ?? {}).reduce((s, n) => s + (Number(n) || 0), 0);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
