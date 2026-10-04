import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { blankById } from "../engine/blanks";
import { colorById } from "../engine/colors";
import { textDataUrl } from "../engine/text";
import { printPx, printToView, VIEW, type Layer } from "../engine/types";
import type { StoreApi } from "../engine/store";

interface Props {
  store: StoreApi;
  onDropFiles: (files: File[]) => void;
  cloudLabel: string;
  cloudTone: "live" | "amber" | "violet";
}

type Drag =
  | { mode: "move"; id: string; startX: number; startY: number; lx: number; ly: number }
  | { mode: "scale"; id: string; cx: number; cy: number; d0: number; s0: number }
  | { mode: "rotate"; id: string; cx: number; cy: number; a0: number; r0: number };

export function Stage({ store, onDropFiles, cloudLabel, cloudTone }: Props) {
  const { state, select, updateLayer, begin, commit } = store;
  const { design, selectedId } = state;
  const blank = blankById(design.blank);
  const color = colorById(design.color);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(600);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dropping, setDropping] = useState(false);
  const [fontsTick, setFontsTick] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setSize(Math.max(200, Math.min(width, height)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    document.fonts.ready.then(() => setFontsTick((t) => t + 1));
    const onLoad = () => setFontsTick((t) => t + 1);
    document.fonts.addEventListener("loadingdone", onLoad);
    return () => document.fonts.removeEventListener("loadingdone", onLoad);
  }, []);

  const k = size / VIEW; // screen px per viewBox unit
  const s = printToView(blank); // viewBox units per print px
  const p = blank.placement;
  const area = printPx(blank);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  const baseSvg = useMemo(() => blank.base(color.hex), [blank, color.hex]);
  const shadeSvg = useMemo(() => blank.shade(color.hex), [blank, color.hex]);

  /** Screen-space center of a layer. */
  const centerOf = useCallback(
    (l: Layer) => {
      const rect = wrapRef.current!.getBoundingClientRect();
      const ox = rect.left + (rect.width - size) / 2;
      const oy = rect.top + (rect.height - size) / 2;
      return { x: ox + (p.x + l.x * s) * k, y: oy + (p.y + l.y * s) * k };
    },
    [k, s, p.x, p.y, size],
  );

  const onLayerDown = (e: React.PointerEvent, l: Layer) => {
    if (l.locked) return;
    e.stopPropagation();
    select(l.id);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    begin();
    setDrag({ mode: "move", id: l.id, startX: e.clientX, startY: e.clientY, lx: l.x, ly: l.y });
  };

  const onHandleDown = (e: React.PointerEvent, l: Layer, mode: "scale" | "rotate") => {
    e.stopPropagation();
    e.preventDefault();
    const c = centerOf(l);
    const dx = e.clientX - c.x, dy = e.clientY - c.y;
    begin();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    if (mode === "scale") setDrag({ mode, id: l.id, cx: c.x, cy: c.y, d0: Math.hypot(dx, dy) || 1, s0: l.scale });
    else setDrag({ mode, id: l.id, cx: c.x, cy: c.y, a0: Math.atan2(dy, dx), r0: l.rotation });
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      if (drag.mode === "move") {
        const dx = (e.clientX - drag.startX) / (k * s);
        const dy = (e.clientY - drag.startY) / (k * s);
        updateLayer(drag.id, { x: Math.round(drag.lx + dx), y: Math.round(drag.ly + dy) }, true);
      } else if (drag.mode === "scale") {
        const d = Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy);
        const next = Math.max(0.02, Math.min(20, drag.s0 * (d / drag.d0)));
        updateLayer(drag.id, { scale: next }, true);
      } else {
        const a = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx);
        let deg = drag.r0 + ((a - drag.a0) * 180) / Math.PI;
        deg = ((deg + 180) % 360 + 360) % 360 - 180;
        if (e.shiftKey) deg = Math.round(deg / 15) * 15;
        else for (const snap of [-180, -90, 0, 90, 180]) if (Math.abs(deg - snap) < 3) deg = snap;
        updateLayer(drag.id, { rotation: Math.round(deg * 10) / 10 }, true);
      }
    };
    const up = () => {
      setDrag(null);
      commit();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [drag, k, s, updateLayer, commit]);

  const selected = design.layers.find((l) => l.id === selectedId) ?? null;
  const hot = Boolean(drag) || dropping;

  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      setDropping(true);
    }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropping(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length) onDropFiles(files);
  };

  return (
    <div
      ref={wrapRef}
      className="stage rounded-2xl"
      onPointerDown={() => select(null)}
      onDragOver={onDragOver}
      onDragLeave={() => setDropping(false)}
      onDrop={onDrop}
    >
      <div className="stage-halo" />
      <div className="stage-floor" />
      <div className="relative" style={{ width: size, height: size }}>
        <div className="world" style={{ transform: `scale(${k})` }}>
          <div className="garment" style={{ filter: "drop-shadow(0 30px 40px rgba(0,0,0,0.6))" }} dangerouslySetInnerHTML={{ __html: baseSvg }} />

          <div className="print-area" style={{ left: p.x, top: p.y, width: area.w, height: area.h, transform: `scale(${s})` }}>
            {design.layers.map((l) => {
              if (!l.visible) return null;
              const w = l.naturalW, h = l.naturalH;
              const src = l.kind === "image" ? l.src : textDataUrl(l, clamp(l.scale * s * k * dpr, 0.2, 2), fontsTick);
              return (
                <div
                  key={l.id}
                  className="layer"
                  data-locked={l.locked}
                  style={{
                    width: w,
                    height: h,
                    opacity: l.opacity,
                    transform: `translate(${l.x}px, ${l.y}px) rotate(${l.rotation}deg) scale(${l.scale}) translate(${-w / 2}px, ${-h / 2}px)`,
                  }}
                  onPointerDown={(e) => onLayerDown(e, l)}
                >
                  <img src={src} alt={l.name} draggable={false} />
                </div>
              );
            })}
          </div>

          <div className="garment" style={{ pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: shadeSvg }} />

          {/* print area guide (drawn above shading so it stays legible) */}
          <div className="print-area" style={{ left: p.x, top: p.y, width: p.w, height: p.h, pointerEvents: "none" }}>
            <div className="print-area-outline" data-hot={hot} style={{ borderWidth: 1.5 / k }} />
            <div className="print-area-label" style={{ transform: `scale(${1 / k})`, transformOrigin: "0 100%" }}>
              {blank.label} {blank.view} · {blank.printIn.w}×{blank.printIn.h} in print area
            </div>
          </div>

          {selected && selected.visible && (
            <Selection layer={selected} k={k} s={s} px={p.x} py={p.y} onHandleDown={onHandleDown} />
          )}
        </div>
      </div>

      {dropping && <div className="drop-hint pop">DROP ARTWORK TO ADD</div>}

      <div className="hud">
        <span className="pill" data-tone={cloudTone}><span className="dot" />{cloudLabel}</span>
        <span className="pill"><span className="dot" />{area.w}×{area.h}px @ 300 DPI</span>
        {selected && (
          <span className="pill" data-tone="violet">
            <span className="dot" />
            {Math.round(selected.rotation)}° · {Math.round(selected.scale * 100)}%
          </span>
        )}
      </div>
    </div>
  );
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function Selection({
  layer: l, k, s, px, py, onHandleDown,
}: {
  layer: Layer; k: number; s: number; px: number; py: number;
  onHandleDown: (e: React.PointerEvent, l: Layer, mode: "scale" | "rotate") => void;
}) {
  const w = l.naturalW * l.scale * s;
  const h = l.naturalH * l.scale * s;
  const cx = px + l.x * s, cy = py + l.y * s;
  const hs = 14 / k; // handle size in viewBox units
  const corners: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1]];
  const stem = 28 / k;
  return (
    <div className="selection" style={{ width: w, height: h, transformOrigin: "50% 50%", transform: `translate(${cx - w / 2}px, ${cy - h / 2}px) rotate(${l.rotation}deg)` }}>
      <div className="selection-box" style={{ outlineWidth: 1.5 / k }} />
      {!l.locked && corners.map(([a, b]) => (
        <div
          key={`${a}${b}`}
          className="handle"
          style={{ left: a * w - hs / 2, top: b * h - hs / 2, width: hs, height: hs, borderRadius: 4 / k, borderWidth: 1.5 / k, cursor: a === b ? "nwse-resize" : "nesw-resize" }}
          onPointerDown={(e) => onHandleDown(e, l, "scale")}
        />
      ))}
      {!l.locked && (
        <>
          <div className="rot-stem" style={{ top: -stem, height: stem, width: 1.5 / k }} />
          <div
            className="handle handle-rot"
            style={{ left: w / 2 - hs / 2, top: -stem - hs, width: hs, height: hs, borderWidth: 1.5 / k }}
            onPointerDown={(e) => onHandleDown(e, l, "rotate")}
          />
        </>
      )}
    </div>
  );
}
