import { INK_PRESETS } from "../engine/colors";
import { blankById } from "../engine/blanks";
import type { StoreApi } from "../engine/store";
import { FONTS } from "../engine/text";
import { printPx, type Layer, type TextLayer } from "../engine/types";
import { ICenter, ICopy, ITrash } from "./icons";

export function Inspector({ store }: { store: StoreApi }) {
  const { state, updateLayer, updateText, remove, duplicate } = store;
  const layer = state.design.layers.find((l) => l.id === state.selectedId) ?? null;
  const blank = blankById(state.design.blank);
  const area = printPx(blank);

  if (!layer) {
    return (
      <aside className="glass rounded-2xl p-4 flex flex-col gap-4 min-h-0">
        <div className="eyebrow">Inspector</div>
        <div className="rounded-xl border border-dashed hairline p-4 text-[12px] text-ink-300 leading-relaxed">
          Select a layer on the garment to edit it.
          <div className="mt-3 flex flex-col gap-1.5 text-[11px]">
            <Row k="Drag" v="move" /><Row k="Corner" v="scale" /><Row k="Orange" v="rotate (⇧ snaps 15°)" />
            <Row k="Arrows" v="nudge (⇧ ×10)" /><Row k="⌘Z / ⌘⇧Z" v="undo / redo" /><Row k="⌘D" v="duplicate" /><Row k="Del" v="delete" />
          </div>
        </div>
        <div className="mt-auto rounded-xl p-3 border hairline bg-black/30 text-[11px] text-ink-300 leading-relaxed">
          <div className="text-ink-100 font-semibold mb-1">Print spec</div>
          {blank.label} {blank.view} · {blank.printIn.w}×{blank.printIn.h} in · {area.w}×{area.h} px · 300 DPI · transparent PNG
        </div>
      </aside>
    );
  }

  const set = (patch: Partial<Layer>, transient = false) => updateLayer(layer.id, patch, transient);
  const inches = (px: number) => (px / 300).toFixed(2);
  const w = layer.naturalW * layer.scale, h = layer.naturalH * layer.scale;

  return (
    <aside className="glass rounded-2xl flex flex-col min-h-0 overflow-hidden">
      <div className="scroll flex-1 min-h-0 p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="eyebrow">{layer.kind === "text" ? "Text layer" : "Artwork layer"}</div>
          <div className="flex gap-1">
            <button className="btn btn-sm btn-ghost" title="Center on blank" onClick={() => set({ x: area.w / 2, y: area.h / 2 })}><ICenter /></button>
            <button className="btn btn-sm btn-ghost" title="Duplicate" onClick={() => duplicate(layer.id)}><ICopy /></button>
            <button className="btn btn-sm btn-ghost btn-danger" title="Delete" onClick={() => remove(layer.id)}><ITrash /></button>
          </div>
        </div>

        {layer.kind === "text" && <TextControls layer={layer} onChange={(p) => updateText(layer.id, p)} />}

        <Section title="Transform">
          <Slider label="Size" value={layer.scale} min={0.05} max={layer.kind === "text" ? 6 : 3} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v, t) => set({ scale: v }, t)} onCommit={store.commit} onBegin={store.begin} />
          <Slider label="Rotate" value={layer.rotation} min={-180} max={180} step={1} fmt={(v) => `${Math.round(v)}°`} onChange={(v, t) => set({ rotation: v }, t)} onCommit={store.commit} onBegin={store.begin} />
          <Slider label="Opacity" value={layer.opacity} min={0.05} max={1} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v, t) => set({ opacity: v }, t)} onCommit={store.commit} onBegin={store.begin} />
          <div className="grid grid-cols-2 gap-2 mt-1">
            <Num label="X (px)" value={Math.round(layer.x)} onChange={(v) => set({ x: v })} />
            <Num label="Y (px)" value={Math.round(layer.y)} onChange={(v) => set({ y: v })} />
          </div>
          <div className="text-[11px] text-ink-300 mt-1">
            Prints at <span className="text-ink-100 font-semibold">{inches(w)} × {inches(h)} in</span> ({Math.round(w)}×{Math.round(h)} px)
            {layer.kind === "image" && layer.scale > 1.02 && <span className="text-amber-glow"> · upscaled {Math.round(layer.scale * 100)}%, may soften</span>}
          </div>
        </Section>
      </div>
    </aside>
  );
}

function TextControls({ layer, onChange }: { layer: TextLayer; onChange: (p: Partial<TextLayer>) => void }) {
  const font = FONTS.find((f) => f.family === layer.fontFamily) ?? FONTS[0];
  return (
    <>
      <Section title="Content">
        <textarea className="field" rows={2} value={layer.text} onChange={(e) => onChange({ text: e.target.value })} placeholder="Type something loud" />
        <div className="grid grid-cols-2 gap-2">
          <select className="field" value={layer.fontFamily} onChange={(e) => { const f = FONTS.find((x) => x.family === e.target.value)!; onChange({ fontFamily: f.family, fontWeight: f.weights.includes(layer.fontWeight) ? layer.fontWeight : f.weights[f.weights.length - 1] }); }} style={{ fontFamily: `"${layer.fontFamily}"` }}>
            {FONTS.map((f) => <option key={f.family} value={f.family} style={{ fontFamily: `"${f.family}"` }}>{f.label}</option>)}
          </select>
          <select className="field" value={layer.fontWeight} onChange={(e) => onChange({ fontWeight: Number(e.target.value) })} disabled={font.weights.length === 1}>
            {font.weights.map((w) => <option key={w} value={w}>{w === 400 ? "Regular" : w === 500 ? "Medium" : w === 600 ? "Semibold" : "Bold"}</option>)}
          </select>
        </div>
        <div className="flex gap-1.5">
          <div className="seg flex-1">
            {(["left", "center", "right"] as const).map((a) => <button key={a} data-active={layer.align === a} onClick={() => onChange({ align: a })} className="flex-1">{a[0].toUpperCase() + a.slice(1)}</button>)}
          </div>
          <div className="seg"><button data-active={layer.uppercase} onClick={() => onChange({ uppercase: !layer.uppercase })}>AA</button></div>
        </div>
      </Section>
      <Section title="Ink">
        <div className="grid grid-cols-10 gap-1">
          {INK_PRESETS.map((c) => <button key={c} className="swatch" data-active={layer.color.toLowerCase() === c} style={{ background: c, borderRadius: 999 }} onClick={() => onChange({ color: c })} />)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Fill" value={layer.color} onChange={(v) => onChange({ color: v })} />
          <ColorField label="Outline" value={layer.strokeColor} onChange={(v) => onChange({ strokeColor: v })} />
        </div>
        <Slider label="Outline width" value={layer.strokeWidth} min={0} max={60} step={1} fmt={(v) => `${v}px`} onChange={(v) => onChange({ strokeWidth: v })} />
        <Slider label="Tracking" value={layer.letterSpacing} min={-0.1} max={0.6} step={0.01} fmt={(v) => `${Math.round(v * 100)}`} onChange={(v) => onChange({ letterSpacing: v })} />
        <Slider label="Line height" value={layer.lineHeight} min={0.7} max={2} step={0.01} fmt={(v) => v.toFixed(2)} onChange={(v) => onChange({ lineHeight: v })} />
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-xl border hairline bg-black/20 p-3">
      <div className="eyebrow">{title}</div>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (<div className="flex justify-between"><span className="kbd">{k}</span><span>{v}</span></div>);
}

function Slider({ label, value, min, max, step, fmt, onChange, onBegin, onCommit }: {
  label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string;
  onChange: (v: number, transient: boolean) => void; onBegin?: () => void; onCommit?: () => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <div className="flex justify-between mb-0.5"><span className="label">{label}</span><span className="text-[11px] font-semibold tabular-nums">{fmt(value)}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} style={{ "--pct": `${pct}%` } as React.CSSProperties}
        onPointerDown={onBegin} onPointerUp={onCommit} onKeyUp={onCommit}
        onChange={(e) => onChange(Number(e.target.value), Boolean(onBegin))} />
    </label>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="label mb-0.5">{label}</div>
      <input className="field" type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="label mb-0.5">{label}</div>
      <div className="field flex items-center gap-2 px-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-6 h-6 rounded-md border-0 bg-transparent p-0 cursor-pointer" />
        <input className="flex-1 min-w-0 bg-transparent outline-none text-[12px] font-mono" value={value} onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && onChange(e.target.value)} />
      </div>
    </label>
  );
}
