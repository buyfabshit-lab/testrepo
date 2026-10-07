/**
 * Procedural camo tiles for the studio (spec §7.4 — camo fills + WATERLINE).
 * Each tile is drawn once to an offscreen canvas and reused as a Fabric Pattern source.
 */
export const CAMO_KINDS = ["woodland", "desert", "urban", "navy", "pink", "black"] as const;
export type CamoKind = (typeof CAMO_KINDS)[number];

export const CAMO_LABELS: Record<CamoKind, string> = {
  woodland: "Woodland", desert: "Desert", urban: "Urban", navy: "Navy", pink: "Pink", black: "Black ops",
};

/** [base, ...blotch layers] — darkest layer last so it reads as shadow. */
const PALETTES: Record<CamoKind, string[]> = {
  woodland: ["#6b7a3a", "#8c8a52", "#4a5a2b", "#2d2b1b"],
  desert:   ["#d2b98a", "#b89a66", "#a88a5a", "#7a6744"],
  urban:    ["#9a9a9a", "#c4c4c4", "#5c5c5c", "#2a2a2a"],
  navy:     ["#2e3f66", "#4a5f8c", "#1c2843", "#0b1120"],
  pink:     ["#e88bb0", "#f4b5cf", "#c4507f", "#7a2d4f"],
  black:    ["#1b1b1b", "#2c2c2c", "#0e0e0e", "#3a3a3a"],
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Draw a wobbly blob (sum of a few sine harmonics around a circle) so edges look organic, not elliptical. */
function blob(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rnd: () => number, color: string) {
  const harmonics = Array.from({ length: 4 }, (_, i) => ({ k: i + 2, a: (rnd() * 0.35) / (i + 1), p: rnd() * Math.PI * 2 }));
  ctx.beginPath();
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const rr = r * (1 + harmonics.reduce((s, h) => s + h.a * Math.sin(h.k * t + h.p), 0));
    const x = cx + Math.cos(t) * rr, y = cy + Math.sin(t) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

const cache = new Map<string, HTMLCanvasElement>();

/** Seamless 256px tile: blobs that cross an edge are re-drawn wrapped on the opposite edge. */
export function camoTile(kind: CamoKind, size = 256): HTMLCanvasElement {
  const key = `${kind}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d")!;
  const [base, ...layers] = PALETTES[kind];
  const rnd = rng(kind.length * 7919 + size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  layers.forEach((color, li) => {
    const count = 7 + li * 3;
    for (let i = 0; i < count; i++) {
      const cx = rnd() * size, cy = rnd() * size;
      const r = size * (0.09 + rnd() * 0.16) * (1 - li * 0.15);
      for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
        // same seed sequence per wrap copy — reset harmonics deterministically
        const local = rng(Math.floor(cx * 31 + cy * 17 + li * 101 + i));
        blob(ctx, cx + dx, cy + dy, r, local, color);
      }
    }
  });
  cache.set(key, c);
  return c;
}

const urlCache = new Map<CamoKind, string>();
export function camoDataUrl(kind: CamoKind): string {
  let u = urlCache.get(kind);
  if (!u) { u = camoTile(kind).toDataURL("image/png"); urlCache.set(kind, u); }
  return u;
}
