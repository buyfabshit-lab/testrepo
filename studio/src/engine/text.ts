import type { TextLayer } from "./types";

export const FONTS: { family: string; label: string; weights: number[] }[] = [
  { family: "Bebas Neue", label: "Bebas Neue", weights: [400] },
  { family: "Anton", label: "Anton", weights: [400] },
  { family: "Oswald", label: "Oswald", weights: [500, 700] },
  { family: "Rubik Mono One", label: "Rubik Mono", weights: [400] },
  { family: "Space Grotesk", label: "Space Grotesk", weights: [400, 500, 600, 700] },
  { family: "Inter", label: "Inter", weights: [400, 500, 600, 700] },
  { family: "Playfair Display", label: "Playfair", weights: [700] },
  { family: "Permanent Marker", label: "Marker", weights: [400] },
  { family: "Monoton", label: "Monoton", weights: [400] },
];

export function fontSpec(l: Pick<TextLayer, "fontFamily" | "fontWeight" | "fontSize">, size = l.fontSize) {
  return `${l.fontWeight} ${size}px "${l.fontFamily}"`;
}

/** Kick off loading of a font face; resolves when usable for canvas. */
export async function ensureFont(l: Pick<TextLayer, "fontFamily" | "fontWeight" | "fontSize">) {
  try {
    await document.fonts.load(fontSpec(l, 64));
  } catch {
    /* font may not exist; fall back silently */
  }
}

/** Wait for webfonts, but never block on a stalled font request. */
export function fontsSettled(timeoutMs = 2500): Promise<void> {
  return Promise.race([document.fonts.ready.then(() => undefined), new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}

export function displayText(l: TextLayer) {
  const t = l.text.length ? l.text : " ";
  return l.uppercase ? t.toUpperCase() : t;
}

interface Measured {
  lines: string[];
  widths: number[];
  width: number;
  height: number;
  lineH: number;
  ascent: number;
  descent: number;
}

function measure(ctx: CanvasRenderingContext2D, l: TextLayer, size: number): Measured {
  ctx.font = fontSpec(l, size);
  ctx.letterSpacing = `${l.letterSpacing * size}px`;
  const lines = displayText(l).split("\n");
  const widths = lines.map((ln) => ctx.measureText(ln.length ? ln : " ").width);
  const lineH = size * l.lineHeight;
  const probe = ctx.measureText("Hg");
  const ascent = probe.fontBoundingBoxAscent || size * 0.8;
  const descent = probe.fontBoundingBoxDescent || size * 0.2;
  const pad = l.strokeWidth * (size / l.fontSize);
  return {
    lines,
    widths,
    width: Math.max(1, Math.ceil(Math.max(...widths) + pad * 2 + size * 0.06)),
    height: Math.max(1, Math.ceil(lineH * lines.length + pad * 2)),
    lineH,
    ascent,
    descent,
  };
}

let probeCtx: CanvasRenderingContext2D | null = null;
function getProbe() {
  if (!probeCtx) probeCtx = document.createElement("canvas").getContext("2d")!;
  return probeCtx;
}

/** Natural size of a text layer in print px (scale 1). */
export function measureText(l: TextLayer): { w: number; h: number } {
  const m = measure(getProbe(), l, l.fontSize);
  return { w: m.width, h: m.height };
}

const MAX_SIDE = 4096;

/**
 * Rasterize a text layer to a canvas. `pxScale` is the number of output pixels
 * per print px (1 for the print file; smaller for the editor).
 */
export function rasterizeText(l: TextLayer, pxScale = 1): HTMLCanvasElement {
  const natural = measureText(l);
  let s = pxScale;
  const longest = Math.max(natural.w, natural.h) * s;
  if (longest > MAX_SIDE) s = (MAX_SIDE / Math.max(natural.w, natural.h)) * 0.999;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(natural.w * s));
  canvas.height = Math.max(1, Math.round(natural.h * s));
  const ctx = canvas.getContext("2d")!;
  const size = l.fontSize * s;
  const m = measure(ctx, l, size);
  ctx.font = fontSpec(l, size);
  ctx.letterSpacing = `${l.letterSpacing * size}px`;
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  const pad = l.strokeWidth * s;
  const stroke = pad > 0;
  m.lines.forEach((ln, i) => {
    const w = m.widths[i];
    let x = pad + size * 0.03;
    if (l.align === "center") x = (canvas.width - w) / 2;
    else if (l.align === "right") x = canvas.width - w - pad - size * 0.03;
    const y = pad + i * m.lineH + (m.lineH - (m.ascent + m.descent)) / 2 + m.ascent;
    if (stroke) {
      ctx.lineWidth = pad * 2;
      ctx.strokeStyle = l.strokeColor;
      ctx.strokeText(ln, x, y);
    }
    ctx.fillStyle = l.color;
    ctx.fillText(ln, x, y);
  });
  return canvas;
}

/** Small memo so the editor doesn't re-rasterize on every render. */
const cache = new Map<string, { key: string; url: string }>();
export function textDataUrl(l: TextLayer, pxScale: number, version = 0): string {
  const key = JSON.stringify([
    version,
    l.text, l.fontFamily, l.fontWeight, l.fontSize, l.color, l.letterSpacing, l.lineHeight, l.align,
    l.strokeWidth, l.strokeColor, l.uppercase, Math.round(pxScale * 1000),
  ]);
  const hit = cache.get(l.id);
  if (hit && hit.key === key) return hit.url;
  const url = rasterizeText(l, pxScale).toDataURL("image/png");
  cache.set(l.id, { key, url });
  return url;
}
