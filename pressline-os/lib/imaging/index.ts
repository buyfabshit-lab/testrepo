import "server-only";
import sharp from "sharp";

/**
 * Imaging tools (spec §7.4) — server-side ports of the Pocket Fixer functions
 * on sharp. Arc text and WATERLINE are canvas-side (components/studio).
 */
export const PRINT_DPI = 300;

export interface ImageInfo { width: number; height: number; dpi: number | null; hasAlpha: boolean; format: string | null }

export async function info(buf: Buffer): Promise<ImageInfo> {
  const m = await sharp(buf).metadata();
  return { width: m.width ?? 0, height: m.height ?? 0, dpi: m.density ?? null, hasAlpha: Boolean(m.hasAlpha), format: m.format ?? null };
}

/** Print size in inches from pixel size at a DPI. */
export function inchesAt(px: number, dpi = PRINT_DPI): number {
  return Math.round((px / dpi) * 100) / 100;
}

/**
 * Ensure a print file is at least 300 DPI for the requested print width.
 * Upscales with Lanczos3 when needed and stamps the pHYs density tag.
 * Returns the PNG plus a warning when the source was under 300 DPI.
 */
export async function ensure300Dpi(buf: Buffer, printWidthIn: number): Promise<{ png: Buffer; sourceDpi: number; upscaled: boolean; warning?: string }> {
  const m = await sharp(buf).metadata();
  const w = m.width ?? 0, h = m.height ?? 0;
  const sourceDpi = Math.round(w / printWidthIn);
  const targetW = Math.round(printWidthIn * PRINT_DPI);
  const targetH = Math.round((h / w) * targetW);
  const upscaled = w < targetW;
  const png = await sharp(buf)
    .resize(targetW, targetH, { kernel: sharp.kernel.lanczos3, fit: "fill" })
    .withMetadata({ density: PRINT_DPI })
    .png({ compressionLevel: 6 })
    .toBuffer();
  return { png, sourceDpi, upscaled, warning: sourceDpi < PRINT_DPI ? `Source is ${sourceDpi} DPI at ${printWidthIn}" — upscaled to 300 DPI; expect softness.` : undefined };
}

/**
 * Background removal (flat-background version): samples the four corners,
 * flood-fills matching pixels to transparent within a tolerance. Good for
 * logos on white/solid backgrounds; for photos use a proper matting service.
 */
export async function removeFlatBackground(buf: Buffer, tolerance = 28): Promise<Buffer> {
  const { data, info: i } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = i;
  const px = (x: number, y: number) => (y * width + x) * channels;
  const corners = [px(0, 0), px(width - 1, 0), px(0, height - 1), px(width - 1, height - 1)];
  const bg = [0, 1, 2].map((c) => Math.round(corners.reduce((s, p) => s + data[p + c], 0) / 4));
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => { if (x >= 0 && y >= 0 && x < width && y < height && !seen[y * width + x]) { seen[y * width + x] = 1; stack.push(x, y); } };
  push(0, 0); push(width - 1, 0); push(0, height - 1); push(width - 1, height - 1);
  while (stack.length) {
    const y = stack.pop()!, x = stack.pop()!;
    const p = px(x, y);
    const d = Math.abs(data[p] - bg[0]) + Math.abs(data[p + 1] - bg[1]) + Math.abs(data[p + 2] - bg[2]);
    if (d > tolerance * 3) continue;
    data[p + 3] = 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

/** Distress: multiply a tiled noise/grunge alpha into the art. `amount` 0–1. */
export async function distress(buf: Buffer, amount = 0.35, seed = 7): Promise<Buffer> {
  const { data, info: i } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = i;
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  // low-frequency blotches + high-frequency speckle
  const blotches = Array.from({ length: Math.round(40 + amount * 120) }, () => ({ x: rnd() * width, y: rnd() * height, r: (8 + rnd() * 40) * (0.5 + amount) }));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * channels;
      if (data[p + 3] === 0) continue;
      let cut = 0;
      for (const b of blotches) {
        const dx = x - b.x, dy = y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < b.r * b.r) cut = Math.max(cut, 1 - Math.sqrt(d2) / b.r);
      }
      if (rnd() < amount * 0.12) cut = Math.max(cut, 0.6 + rnd() * 0.4);
      if (cut > 0) data[p + 3] = Math.round(data[p + 3] * (1 - Math.min(1, cut * (0.6 + amount))));
    }
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

/** Thumbnail for the vault / proof page. */
export async function thumbnail(buf: Buffer, size = 400): Promise<Buffer> {
  return sharp(buf).resize(size, size, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
}

/** Quick color count estimate (for screen-print quoting): quantize to a 5-bit cube, count buckets with >0.5% coverage. */
export async function estimateColors(buf: Buffer): Promise<number> {
  const { data, info: i } = await sharp(buf).resize(200, 200, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const counts = new Map<number, number>();
  let total = 0;
  for (let p = 0; p < data.length; p += i.channels) {
    if (data[p + 3] < 128) continue;
    const key = ((data[p] >> 3) << 10) | ((data[p + 1] >> 3) << 5) | (data[p + 2] >> 3);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    total++;
  }
  if (!total) return 0;
  return Array.from(counts.values()).filter((c) => c / total > 0.005).length;
}
