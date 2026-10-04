import { blankById } from "./blanks";
import { colorById } from "./colors";
import { loadImage, svgToImage } from "./images";
import { canvasToBlob, withDpi } from "./png";
import { rasterizeText } from "./text";
import { DPI, VIEW, printPx, printToView, type Design, type Layer } from "./types";

/** Draw every visible layer in print-px space onto `ctx` (already transformed). */
export async function drawLayers(ctx: CanvasRenderingContext2D, layers: Layer[], pxScale = 1) {
  for (const l of layers) {
    if (!l.visible) continue;
    let img: CanvasImageSource;
    if (l.kind === "image") {
      try {
        img = await loadImage(l.src);
      } catch {
        continue;
      }
    } else {
      img = rasterizeText(l, Math.max(0.25, Math.min(4, pxScale * l.scale)));
    }
    ctx.save();
    ctx.globalAlpha = l.opacity;
    ctx.translate(l.x, l.y);
    ctx.rotate((l.rotation * Math.PI) / 180);
    ctx.scale(l.scale, l.scale);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, -l.naturalW / 2, -l.naturalH / 2, l.naturalW, l.naturalH);
    ctx.restore();
  }
}

/** 300 DPI transparent print file, exactly the blank's print area. */
export async function renderPrintFile(design: Design): Promise<{ blob: Blob; width: number; height: number }> {
  const blank = blankById(design.blank);
  const { w, h } = printPx(blank);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  await drawLayers(ctx, design.layers, 1);
  const blob = await withDpi(await canvasToBlob(canvas), DPI);
  return { blob, width: w, height: h };
}

export interface MockupOptions {
  size?: number;
  backdrop?: "studio" | "transparent";
}

/** Garment mockup with the design composited under the fabric lighting. */
export async function renderMockup(design: Design, opts: MockupOptions = {}): Promise<{ blob: Blob; width: number; height: number; canvas: HTMLCanvasElement }> {
  const size = opts.size ?? 2000;
  const backdrop = opts.backdrop ?? "studio";
  const blank = blankById(design.blank);
  const color = colorById(design.color);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const k = size / VIEW;

  if (backdrop === "studio") {
    const bg = ctx.createRadialGradient(size * 0.5, size * 0.42, size * 0.05, size * 0.5, size * 0.5, size * 0.75);
    bg.addColorStop(0, "#2a2d3c");
    bg.addColorStop(0.55, "#121420");
    bg.addColorStop(1, "#06070b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    // accent glows
    const g1 = ctx.createRadialGradient(size * 0.18, size * 0.2, 0, size * 0.18, size * 0.2, size * 0.45);
    g1.addColorStop(0, "rgba(124,92,255,0.28)");
    g1.addColorStop(1, "rgba(124,92,255,0)");
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, size, size);
    const g2 = ctx.createRadialGradient(size * 0.85, size * 0.85, 0, size * 0.85, size * 0.85, size * 0.5);
    g2.addColorStop(0, "rgba(245,158,11,0.18)");
    g2.addColorStop(1, "rgba(245,158,11,0)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, size, size);
    // floor shadow under garment
    const sh = ctx.createRadialGradient(size * 0.5, size * 0.9, 0, size * 0.5, size * 0.9, size * 0.45);
    sh.addColorStop(0, "rgba(0,0,0,0.55)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.scale(1, 0.35);
    ctx.fillStyle = sh;
    ctx.fillRect(0, 0, size, size / 0.35);
    ctx.restore();
  }

  const [base, shade] = await Promise.all([svgToImage(blank.base(color.hex)), svgToImage(blank.shade(color.hex))]);

  // garment drop shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = size * 0.04;
  ctx.shadowOffsetY = size * 0.02;
  ctx.drawImage(base, 0, 0, size, size);
  ctx.restore();

  // design, clipped to print area, projected into garment space
  const p = blank.placement;
  const s = printToView(blank);
  ctx.save();
  ctx.beginPath();
  ctx.rect(p.x * k, p.y * k, p.w * k, p.h * k);
  ctx.clip();
  ctx.translate(p.x * k, p.y * k);
  ctx.scale(s * k, s * k);
  ctx.globalAlpha = 0.97;
  await drawLayers(ctx, design.layers, s * k);
  ctx.restore();

  ctx.drawImage(shade, 0, 0, size, size);

  const blob = await canvasToBlob(canvas);
  return { blob, width: size, height: size, canvas };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function slug(s: string) {
  return (s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "design").slice(0, 40);
}
