import { useEffect, useRef } from "react";
import type { Body } from "../lib/types";

/**
 * The field the bubbles sit in.
 *
 * A lattice of points is drawn behind the canvas, and every bubble bends the
 * lattice toward itself — the more mass, the deeper the well. It is the Higgs
 * picture borrowed as an interface: the field is the thing that is everywhere,
 * and what you can see of it is only where something is interacting with it.
 *
 * Drawn on a plain 2D canvas rather than in the SVG because a warped lattice is
 * a few thousand primitives a frame, and that many DOM nodes would cost far
 * more than the picture is worth.
 */

type Props = {
  bodies: Body[];
  /** thought id -> cluster hue, so the field takes on the colour of what bends it */
  hueOf: Map<string, number>;
  camera: { x: number; y: number; scale: number };
  width: number;
  height: number;
};

/** Screen-space lattice pitch. Constant in pixels, so cost does not vary with zoom. */
const PITCH = 30;
/** Past this the influence is too faint to see, and not worth the arithmetic. */
const CUTOFF = 0.025;
/** How far a point is dragged toward a well, as a fraction of its distance. */
const WARP = 0.55;

export default function FieldCanvas({ bodies, hueOf, camera, width, height }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawn = useRef("");

  // Redraws on every render, which is every simulation frame while the canvas
  // has energy — and never once it settles, because nothing re-renders then.
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || width <= 0 || height <= 0) return;

    // The light follows the pointer, so the parent re-renders on every mouse
    // move. The field only depends on where the bodies and camera are, so skip
    // the (expensive) redraw whenever those have not actually moved.
    let checksum = 0;
    for (const body of bodies) checksum += body.x * 0.31 + body.y * 0.17 + body.r;
    const signature = `${camera.x.toFixed(1)}|${camera.y.toFixed(1)}|${camera.scale.toFixed(3)}|${width}|${height}|${bodies.length}|${checksum.toFixed(1)}`;
    if (drawn.current === signature) return;
    drawn.current = signature;

    const context = canvas.getContext("2d");
    if (!context) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    // Project the bodies into screen space once, dropping anything far enough
    // off-screen that it cannot bend a lattice point we are going to draw.
    type Well = { x: number; y: number; rr: number; hue: number };
    const wells: Well[] = [];
    let maxRadius = 1;
    for (const body of bodies) {
      const r = body.r * camera.scale;
      const x = (body.x - camera.x) * camera.scale + width / 2;
      const y = (body.y - camera.y) * camera.scale + height / 2;
      const reach = r * 3.2;
      if (x < -reach || x > width + reach || y < -reach || y > height + reach) continue;
      wells.push({ x, y, rr: r * r, hue: hueOf.get(body.id) ?? 210 });
      if (r > maxRadius) maxRadius = r;
    }

    // Bucket the wells so each lattice point only consults its own neighbourhood.
    // The cell is sized to the largest well's reach, so the 3x3 lookup below can
    // never miss one that would have mattered.
    const cell = Math.max(160, maxRadius * 3.2);
    const buckets = new Map<number, Well[]>();
    const columns = Math.ceil(width / cell) + 3;
    const key = (cx: number, cy: number) => (cy + 1) * columns + (cx + 1);
    for (const well of wells) {
      const index = key(Math.floor(well.x / cell), Math.floor(well.y / cell));
      const bucket = buckets.get(index);
      if (bucket) bucket.push(well);
      else buckets.set(index, [well]);
    }

    const cols = Math.ceil(width / PITCH) + 1;
    const rows = Math.ceil(height / PITCH) + 1;
    const count = cols * rows;
    const px = new Float32Array(count);
    const py = new Float32Array(count);
    const intensity = new Float32Array(count);
    const hues = new Float32Array(count);

    const nearby: Well[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const sx = col * PITCH;
        const sy = row * PITCH;

        nearby.length = 0;
        const cx = Math.floor(sx / cell);
        const cy = Math.floor(sy / cell);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const bucket = buckets.get(key(cx + dx, cy + dy));
            if (bucket) for (const well of bucket) nearby.push(well);
          }
        }

        let phi = 0;
        let wx = 0;
        let wy = 0;
        let hueSum = 0;
        let hueWeight = 0;
        // How far inside a body this point lies, 0 at the surface and 1 at the
        // core. The field is expelled from inside the mass it is bending
        // around, which piles the lattice up into a halo at each rim — and
        // leaves the glass clear enough to read the label through.
        let depth = 0;
        for (const well of nearby) {
          const dx = sx - well.x;
          const dy = sy - well.y;
          const d2 = dx * dx + dy * dy;
          // A Lorentzian well: 1 at the centre, falling smoothly with distance.
          const influence = well.rr / (d2 + well.rr);
          if (influence < CUTOFF) continue;
          phi += influence;
          wx -= dx * influence * WARP;
          wy -= dy * influence * WARP;
          hueSum += well.hue * influence;
          hueWeight += influence;
          const inside = 1 - d2 / well.rr;
          if (inside > depth) depth = inside;
        }

        const index = row * cols + col;
        px[index] = sx + wx;
        py[index] = sy + wy;
        const expelled = depth <= 0 ? 1 : depth >= 1 ? 0 : (1 - depth) ** 1.5;
        intensity[index] = (phi > 1 ? 1 : phi) * expelled;
        hues[index] = hueWeight > 0 ? hueSum / hueWeight : -1;
      }
    }

    // The lattice lines first, so the points sit on top of their own grid.
    context.lineWidth = 1;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const a = row * cols + col;
        const strength = intensity[a];
        for (const b of [col + 1 < cols ? a + 1 : -1, row + 1 < rows ? a + cols : -1]) {
          if (b < 0) continue;
          const lit = (strength + intensity[b]) / 2;
          if (lit < 0.012) continue;
          const alpha = 0.04 + lit * 0.46;
          const hue = hues[a] >= 0 ? hues[a] : hues[b];
          context.strokeStyle =
            hue >= 0
              ? `hsla(${hue} 75% 68% / ${alpha})`
              : `hsla(225 28% 62% / ${alpha * 0.8})`;
          context.beginPath();
          context.moveTo(px[a], py[a]);
          context.lineTo(px[b], py[b]);
          context.stroke();
        }
      }
    }

    for (let index = 0; index < count; index++) {
      const lit = intensity[index];
      if (lit < 0.012) continue;
      const radius = 0.75 + lit * 2.1;
      const hue = hues[index];
      context.fillStyle =
        hue >= 0
          ? `hsla(${hue} 90% 74% / ${0.2 + lit * 0.72})`
          : `hsla(225 32% 72% / 0.18)`;
      context.beginPath();
      context.arc(px[index], py[index], radius, 0, Math.PI * 2);
      context.fill();
    }
  });

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ width, height }}
    />
  );
}
