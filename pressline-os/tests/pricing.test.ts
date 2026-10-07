import { describe, expect, it } from "vitest";
import { pickRule, priceLine, priceQuote, sumSizes, type PriceRule } from "@/lib/pricing";

const rules: PriceRule[] = [
  { method: "dtf", qty_min: 1, qty_max: 11, base: 9.5, per_location: 4, per_color: 0, setup_fee: 0, margin_pct: 0.55 },
  { method: "dtf", qty_min: 12, qty_max: 47, base: 7.25, per_location: 3, per_color: 0, setup_fee: 0, margin_pct: 0.5 },
  { method: "screen", qty_min: 24, qty_max: 71, base: 5.5, per_location: 2.5, per_color: 0.9, setup_fee: 25, margin_pct: 0.45 },
];

describe("pricing", () => {
  it("picks the rule by method and qty band", () => {
    expect(pickRule(rules, "dtf", 12)?.base).toBe(7.25);
    expect(pickRule(rules, "dtf", 11)?.base).toBe(9.5);
    expect(pickRule(rules, "emb", 5)).toBeNull();
  });
  it("prices a DTF line: (blank + base + extra locations) / (1 - margin)", () => {
    const r = priceLine({ method: "dtf", qty: 24, blankCost: 3.1, locations: 2, colors: 1 }, rules);
    // (3.10 + 7.25 + 3.00) / 0.5 = 26.70
    expect(r.unit).toBe(26.7);
    expect(r.setup).toBe(0);
    expect(r.line).toBe(640.8);
  });
  it("adds screen setup once and per-color", () => {
    const r = priceLine({ method: "screen", qty: 24, blankCost: 3.1, locations: 1, colors: 3 }, rules);
    // (3.10 + 5.50 + 2.70) / 0.55 = 20.545 → 20.55
    expect(r.unit).toBe(20.55);
    expect(r.setup).toBe(25);
    expect(r.line).toBe(20.55 * 24 + 25);
  });
  it("rush multiplies the unit by 1.25", () => {
    const base = priceLine({ method: "dtf", qty: 12, blankCost: 0, locations: 1, colors: 1 }, rules).unit;
    const rush = priceLine({ method: "dtf", qty: 12, blankCost: 0, locations: 1, colors: 1, rush: true }, rules).unit;
    expect(rush).toBe(Math.round(base * 1.25 * 100) / 100);
  });
  it("totals a quote and sums sizes", () => {
    expect(sumSizes({ S: 4, M: 10, L: 6 })).toBe(20);
    const q = priceQuote([{ method: "dtf", qty: 20, blankCost: 3, locations: 1, colors: 1 }], rules);
    expect(q.total).toBe(q.subtotal);
    expect(q.lines[0].rule?.qty_min).toBe(12);
  });
});
