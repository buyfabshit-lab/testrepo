/**
 * Blank geometry for the studio. Logical canvas units are px at PX_PER_IN;
 * the export multiplies up to 300 DPI (spec §7.4).
 */
export const PX_PER_IN = 24;
export const PRINT_DPI = 300;

export type BlankKey = "tee" | "hat" | "sticker";
export type Location = "front" | "back" | "left_chest" | "sticker";
export type PrintMethod = "dtf" | "uv";

export interface PrintArea { w: number; h: number; cx: number; cy: number } // inches + centre in logical px
export interface BlankDef {
  key: BlankKey;
  label: string;
  style: string;      // S&S style number used for /api/blanks + designs.blank_style
  brand: string;
  canvas: { w: number; h: number };
  method: PrintMethod;
  /** true → never call /api/blanks; always draw the studio background */
  noPhoto?: boolean;
  sides: Location[];
  areas: Record<Location, PrintArea | undefined>;
  /** Which photo a location uses */
  photoFor: (loc: Location) => "front" | "back";
}

export const BLANKS: Record<BlankKey, BlankDef> = {
  tee: {
    key: "tee", label: "Tee · Gildan 5000", style: "5000", brand: "Gildan",
    canvas: { w: 600, h: 700 }, method: "dtf",
    sides: ["front", "back", "left_chest"],
    areas: {
      front:      { w: 12, h: 16, cx: 300, cy: 380 },
      back:       { w: 12, h: 16, cx: 300, cy: 360 },
      left_chest: { w: 4,  h: 4,  cx: 372, cy: 250 },
      sticker: undefined,
    },
    photoFor: (loc) => (loc === "back" ? "back" : "front"),
  },
  hat: {
    key: "hat", label: "Hat · Richardson 112", style: "112", brand: "Richardson",
    canvas: { w: 600, h: 440 }, method: "dtf",
    sides: ["front"],
    areas: {
      front: { w: 4.5, h: 2.25, cx: 300, cy: 215 },
      back: undefined, left_chest: undefined, sticker: undefined,
    },
    photoFor: () => "front",
  },
  sticker: {
    key: "sticker", label: "UV sticker", style: "UVSTICKER", brand: "MF",
    canvas: { w: 520, h: 520 }, method: "uv", noPhoto: true,
    sides: ["sticker"],
    areas: {
      sticker: { w: 4, h: 4, cx: 260, cy: 260 },
      front: undefined, back: undefined, left_chest: undefined,
    },
    photoFor: () => "front",
  },
};

export const LOCATION_LABELS: Record<Location, string> = { front: "Front", back: "Back", left_chest: "Left chest", sticker: "Sticker" };

/** Print-area rectangle in logical px. */
export function areaRect(blank: BlankKey, loc: Location) {
  const a = BLANKS[blank].areas[loc] ?? BLANKS[blank].areas.front!;
  const w = a.w * PX_PER_IN, h = a.h * PX_PER_IN;
  return { left: a.cx - w / 2, top: a.cy - h / 2, width: w, height: h, inW: a.w, inH: a.h };
}

export interface GarmentColor { name: string; hex: string; ss: string }
/** 16 garment colours. `ss` is the S&S colour name used on /api/blanks?color=. */
export const COLORS: GarmentColor[] = [
  { name: "Black", hex: "#141414", ss: "Black" },
  { name: "White", hex: "#f2f2f2", ss: "White" },
  { name: "Navy", hex: "#1c2541", ss: "Navy" },
  { name: "Charcoal", hex: "#3b3b3b", ss: "Charcoal" },
  { name: "Sport Grey", hex: "#9a9a9a", ss: "Sport Grey" },
  { name: "Red", hex: "#b3122b", ss: "Red" },
  { name: "Maroon", hex: "#5e1a2a", ss: "Maroon" },
  { name: "Royal", hex: "#2546a8", ss: "Royal" },
  { name: "Forest", hex: "#1f4a2e", ss: "Forest Green" },
  { name: "Military", hex: "#4f5a3a", ss: "Military Green" },
  { name: "Sand", hex: "#d9cbb0", ss: "Sand" },
  { name: "Brown", hex: "#4a3222", ss: "Dark Chocolate" },
  { name: "Orange", hex: "#e2641e", ss: "Orange" },
  { name: "Gold", hex: "#d4a94f", ss: "Gold" },
  { name: "Purple", hex: "#4b2a7a", ss: "Purple" },
  { name: "Pink", hex: "#e88bb0", ss: "Azalea" },
];

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Flat silhouettes so the studio works with no API. Tinted by garment colour. */
export function fallbackSvg(blank: BlankKey, side: "front" | "back", hex: string): string {
  const dark = shade(hex, -28), light = shade(hex, 18);
  if (blank === "sticker") {
    // Dark matte sticker sheet: subtle dot grid, a die-cut outline around the 4×4 area.
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" width="520" height="520">
      <defs><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="1" fill="#2a2823"/></pattern></defs>
      <rect width="520" height="520" fill="#171613"/>
      <rect width="520" height="520" fill="url(#dots)"/>
      <rect x="160" y="160" width="200" height="200" rx="18" fill="#1b1a16" stroke="#3a3326" stroke-width="2"/>
      <text x="260" y="498" text-anchor="middle" font-family="Courier New, monospace" font-size="11" fill="#4a4538" letter-spacing="3">UV DTF · DIE CUT · 4 × 4 IN</text>
    </svg>`;
  }
  if (blank === "tee") {
    const collar = side === "front"
      ? `<path d="M250 70 q50 60 100 0" fill="none" stroke="${dark}" stroke-width="10"/>`
      : `<path d="M250 70 q50 22 100 0" fill="none" stroke="${dark}" stroke-width="10"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 700" width="600" height="700">
      <path d="M250 70 L140 110 L60 250 L150 300 L150 650 L450 650 L450 300 L540 250 L460 110 L350 70 Q300 120 250 70 Z" fill="${hex}" stroke="${dark}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M150 300 L60 250" stroke="${dark}" stroke-width="3"/><path d="M450 300 L540 250" stroke="${dark}" stroke-width="3"/>
      <path d="M190 330 q-20 160 0 300" fill="none" stroke="${light}" stroke-opacity=".25" stroke-width="12"/>
      ${collar}
    </svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 440" width="600" height="440">
    <path d="M120 250 Q120 90 300 90 Q480 90 480 250 L480 290 Q300 330 120 290 Z" fill="${hex}" stroke="${dark}" stroke-width="4"/>
    <path d="M300 90 L300 290" stroke="${dark}" stroke-width="2" stroke-opacity=".5"/>
    <path d="M300 90 Q230 160 200 290" stroke="${dark}" stroke-width="2" stroke-opacity=".5" fill="none"/>
    <path d="M300 90 Q370 160 400 290" stroke="${dark}" stroke-width="2" stroke-opacity=".5" fill="none"/>
    <path d="M60 300 Q300 360 540 300 Q560 330 540 350 Q300 410 60 350 Q40 330 60 300 Z" fill="${dark}" stroke="${shade(hex, -50)}" stroke-width="3"/>
    <ellipse cx="300" cy="92" rx="12" ry="6" fill="${dark}"/>
  </svg>`;
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, " "))}`;
}
