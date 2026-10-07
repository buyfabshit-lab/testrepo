import { describe, expect, it } from "vitest";
import { GANG_SHEET, nest, pixelBox } from "@/lib/nesting";

describe("gang sheet nesting", () => {
  it("packs 12×16 prints across a 22\" sheet one per row (two don't fit with bleed+gap)", () => {
    const items = Array.from({ length: 3 }, (_, i) => ({ id: `i${i}`, designId: "d", orderId: "o", widthIn: 12, heightIn: 16 }));
    const sheets = nest(items, { maxHeightIn: 100 });
    expect(sheets).toHaveLength(1);
    expect(sheets[0].placements).toHaveLength(3);
    // 12.25 + 0.25 + 12.25 > 22 → each row holds one
    expect(sheets[0].heightInches).toBe(Math.ceil(3 * 16.25 + 2 * 0.25));
  });
  it("fits four 4×4 left-chest prints in one row", () => {
    const items = Array.from({ length: 4 }, (_, i) => ({ id: `c${i}`, designId: "d", widthIn: 4, heightIn: 4 }));
    const [s] = nest(items);
    expect(s.placements.every((p) => p.y === 0)).toBe(true);
    expect(s.heightInches).toBe(5);
  });
  it("spills onto a second sheet when the cap is hit and costs by area", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: `b${i}`, designId: "d", widthIn: 12, heightIn: 16 }));
    const sheets = nest(items, { maxHeightIn: 50 });
    expect(sheets.length).toBeGreaterThan(1);
    const total = sheets.reduce((s, x) => s + x.printCount, 0);
    expect(total).toBe(10);
    expect(sheets[0].sheetCost).toBeCloseTo(GANG_SHEET.WIDTH_INCHES * sheets[0].heightInches * GANG_SHEET.COST_PER_SQ_IN, 2);
  });
  it("skips items wider than the sheet instead of looping", () => {
    expect(nest([{ id: "x", designId: "d", widthIn: 30, heightIn: 2 }])).toHaveLength(0);
  });
  it("pixel box sits inside the bleed at 300 DPI", () => {
    const [s] = nest([{ id: "p", designId: "d", widthIn: 10, heightIn: 10 }]);
    const box = pixelBox(s.placements[0]);
    expect(box.left).toBe(Math.round(GANG_SHEET.BLEED_INCHES * 300));
    expect(box.width).toBe(3000);
  });
});
