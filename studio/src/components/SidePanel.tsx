import { useRef } from "react";
import { BLANK_ORDER, blankById } from "../engine/blanks";
import { GARMENT_COLORS } from "../engine/colors";
import type { StoreApi } from "../engine/store";
import { textDataUrl } from "../engine/text";
import type { BlankId } from "../engine/types";
import { ICopy, IDown, IEye, IEyeOff, ILock, ITrash, IText, IUnlock, IUp, IUpload } from "./icons";

interface Props {
  store: StoreApi;
  onFiles: (files: File[]) => void;
}

export function SidePanel({ store, onFiles }: Props) {
  const { state, setBlank, setColor, addText, select, updateLayer, remove, duplicate, reorder } = store;
  const { design, selectedId } = state;
  const fileRef = useRef<HTMLInputElement>(null);
  const layersTopFirst = [...design.layers].reverse();

  return (
    <aside className="glass rounded-2xl flex flex-col min-h-0 overflow-hidden">
      <div className="scroll flex-1 min-h-0 p-4 flex flex-col gap-5">
        <section>
          <div className="eyebrow mb-2">01 · Blank</div>
          <div className="grid grid-cols-2 gap-2">
            {BLANK_ORDER.map((id) => (
              <BlankCard key={id} id={id} active={design.blank === id} onClick={() => setBlank(id)} />
            ))}
          </div>
        </section>

        <section>
          <div className="eyebrow mb-2 flex items-center justify-between">
            <span>02 · Color</span>
            <span className="normal-case tracking-normal text-[11px] text-ink-300 font-medium">{GARMENT_COLORS.find((c) => c.id === design.color)?.name}</span>
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {GARMENT_COLORS.map((c) => (
              <button key={c.id} className="swatch" title={c.name} data-active={design.color === c.id} style={{ background: c.hex }} onClick={() => setColor(c.id)} />
            ))}
          </div>
        </section>

        <section>
          <div className="eyebrow mb-2">03 · Add</div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn" onClick={() => fileRef.current?.click()}><IUpload /> Upload art</button>
            <button className="btn" onClick={() => addText()}><IText /> Add text</button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) onFiles(files);
              e.target.value = "";
            }}
          />
          <p className="mt-2 text-[11px] text-ink-300 leading-snug">PNG with transparency prints cleanest. Drop files straight onto the garment too.</p>
        </section>

        <section className="flex-1 min-h-0">
          <div className="eyebrow mb-2 flex items-center justify-between">
            <span>04 · Layers</span>
            <span className="normal-case tracking-normal text-[11px] text-ink-300 font-medium">{design.layers.length}</span>
          </div>
          {layersTopFirst.length === 0 ? (
            <div className="rounded-xl border border-dashed hairline p-4 text-center text-[12px] text-ink-300">
              Nothing on the blank yet. Upload art or add text.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {layersTopFirst.map((l, i) => {
                const idx = design.layers.length - 1 - i;
                const thumb = l.kind === "image" ? l.src : textDataUrl(l, 0.08);
                return (
                  <div key={l.id} className="layer-row" data-active={selectedId === l.id} onClick={() => select(l.id)}>
                    <div className="thumb"><img src={thumb} alt="" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold truncate" style={{ opacity: l.visible ? 1 : 0.45 }}>{l.name}</div>
                      <div className="text-[10.5px] text-ink-300 uppercase tracking-wider">{l.kind}</div>
                    </div>
                    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <IconBtn title="Move up" disabled={idx === design.layers.length - 1} onClick={() => reorder(l.id, "up")}><IUp width={13} height={13} /></IconBtn>
                      <IconBtn title="Move down" disabled={idx === 0} onClick={() => reorder(l.id, "down")}><IDown width={13} height={13} /></IconBtn>
                      <IconBtn title={l.visible ? "Hide" : "Show"} onClick={() => updateLayer(l.id, { visible: !l.visible })}>{l.visible ? <IEye width={13} height={13} /> : <IEyeOff width={13} height={13} />}</IconBtn>
                      <IconBtn title={l.locked ? "Unlock" : "Lock"} onClick={() => updateLayer(l.id, { locked: !l.locked })}>{l.locked ? <ILock width={13} height={13} /> : <IUnlock width={13} height={13} />}</IconBtn>
                      <IconBtn title="Duplicate" onClick={() => duplicate(l.id)}><ICopy width={13} height={13} /></IconBtn>
                      <IconBtn title="Delete" danger onClick={() => remove(l.id)}><ITrash width={13} height={13} /></IconBtn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}

function IconBtn({ children, title, onClick, disabled, danger }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`w-6 h-6 grid place-items-center rounded-md text-ink-300 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:hover:bg-transparent ${danger ? "hover:!text-rose-glow" : ""}`}
    >
      {children}
    </button>
  );
}

function BlankCard({ id, active, onClick }: { id: BlankId; active: boolean; onClick: () => void }) {
  const b = blankById(id);
  // Lightweight silhouette preview: base artwork only, no filters.
  const svg = b.base("#8c92ad");
  return (
    <button className="blank-card" data-active={active} onClick={onClick}>
      <div className="aspect-square w-full rounded-lg overflow-hidden grid place-items-center" style={{ background: "radial-gradient(60% 60% at 50% 40%, rgba(255,255,255,0.08), transparent 70%)" }}>
        <div className="w-full h-full [&>svg]:w-full [&>svg]:h-full" style={{ filter: active ? "drop-shadow(0 0 10px rgba(124,92,255,0.7))" : "drop-shadow(0 6px 10px rgba(0,0,0,0.5))" }} dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-1 whitespace-nowrap">
        <span className="text-[12px] font-semibold truncate">{b.label} <span className="text-ink-300 font-medium">{b.view}</span></span>
        <span className="text-[10px] text-ink-300">{b.printIn.w}×{b.printIn.h}"</span>
      </div>
    </button>
  );
}
