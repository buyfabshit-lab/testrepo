/**
 * Gang sheet nesting — port of the midnightnest / Standalone gangSheetEngine.
 * Strip packing onto 22"-wide sheets with dynamic height. Largest first,
 * 0.125" bleed per side, 0.25" gap. Order sequence kept inside a strip.
 */
export const GANG_SHEET = {
  WIDTH_INCHES: 22,
  MAX_HEIGHT_INCHES: 350,
  DEFAULT_MAX_HEIGHT_INCHES: 100,
  COST_PER_SQ_IN: 60 / 7700,
  BLEED_INCHES: 0.125,
  GAP_INCHES: 0.25,
  DPI: 300,
} as const;

export interface PrintItem { id: string; designId: string; orderId?: string | null; widthIn: number; heightIn: number; location?: string }
export interface Placed extends PrintItem { x: number; y: number; placedWidth: number; placedHeight: number }
export interface SheetLayout {
  sheetNumber: number; widthInches: number; heightInches: number; totalAreaSqIn: number; usedAreaSqIn: number;
  utilizationPct: number; sheetCost: number; costPerPrint: number; placements: Placed[]; printCount: number; orderCount: number;
}

const { BLEED_INCHES: BLEED, GAP_INCHES: GAP, WIDTH_INCHES: W } = GANG_SHEET;

function sortBySize(items: PrintItem[]): PrintItem[] {
  return [...items].sort((a, b) => (b.heightIn + BLEED * 2) - (a.heightIn + BLEED * 2) || (b.widthIn + BLEED * 2) - (a.widthIn + BLEED * 2));
}

function pack(items: PrintItem[], maxHeight: number) {
  const placed: Placed[] = [], remaining: PrintItem[] = [];
  let x = 0, y = 0, strip = 0, maxY = 0;
  for (const it of items) {
    const pw = it.widthIn + BLEED * 2, ph = it.heightIn + BLEED * 2;
    if (pw > W) { remaining.push(it); continue; }
    if (x + pw > W) { x = 0; y += strip + GAP; strip = 0; }
    if (y + ph > maxHeight) { remaining.push(it); continue; }
    placed.push({ ...it, x, y, placedWidth: pw, placedHeight: ph });
    x += pw + GAP;
    strip = Math.max(strip, ph);
    maxY = Math.max(maxY, y + ph);
  }
  return { placed, remaining, height: maxY };
}

export function nest(items: PrintItem[], opts: { maxHeightIn?: number } = {}): SheetLayout[] {
  const maxH = Math.min(opts.maxHeightIn ?? GANG_SHEET.DEFAULT_MAX_HEIGHT_INCHES, GANG_SHEET.MAX_HEIGHT_INCHES);
  let remaining = sortBySize(items);
  const sheets: SheetLayout[] = [];
  let n = 1;
  while (remaining.length) {
    const { placed, remaining: left, height } = pack(remaining, maxH);
    if (!placed.length) {
      console.warn(`[nest] ${remaining.length} item(s) exceed the sheet and were skipped`);
      break;
    }
    const heightInches = Math.ceil(height);
    const totalArea = W * heightInches;
    const used = placed.reduce((s, p) => s + p.placedWidth * p.placedHeight, 0);
    const sheetCost = Number((totalArea * GANG_SHEET.COST_PER_SQ_IN).toFixed(2));
    sheets.push({
      sheetNumber: n++, widthInches: W, heightInches, totalAreaSqIn: totalArea, usedAreaSqIn: Number(used.toFixed(1)),
      utilizationPct: Number(((used / totalArea) * 100).toFixed(1)), sheetCost, costPerPrint: Number((sheetCost / placed.length).toFixed(4)),
      placements: placed, printCount: placed.length, orderCount: new Set(placed.map((p) => p.orderId ?? p.designId)).size,
    });
    remaining = left;
  }
  return sheets;
}

/** Pixel box for a placement at 300 DPI: art sits inside the bleed. */
export function pixelBox(p: Placed, dpi = GANG_SHEET.DPI) {
  return {
    left: Math.round((p.x + BLEED) * dpi), top: Math.round((p.y + BLEED) * dpi),
    width: Math.max(1, Math.round(p.widthIn * dpi)), height: Math.max(1, Math.round(p.heightIn * dpi)),
  };
}
