import { useEffect, useState } from "react";
import { deleteDesign, listDesigns, type SavedDesign, type StorageMode } from "../lib/designs";
import { blankById } from "../engine/blanks";
import { ITrash, IX } from "./icons";

interface Props {
  onClose: () => void;
  onLoad: (d: SavedDesign) => void;
  onError: (msg: string) => void;
}

export function SavedDrawer({ onClose, onLoad, onError }: Props) {
  const [items, setItems] = useState<SavedDesign[] | null>(null);
  const [mode, setMode] = useState<StorageMode>("local");

  const refresh = () =>
    listDesigns()
      .then((r) => { setItems(r.designs); setMode(r.mode); })
      .catch((e) => { onError(e instanceof Error ? e.message : "Could not load designs"); setItems([]); });

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="modal-bg" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="glass rounded-3xl w-full max-w-3xl p-5 pop max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="eyebrow">Saved designs</div>
            <h2 className="text-xl font-bold mt-1">{mode === "cloud" ? "Your cloud library" : "Saved on this device"}</h2>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><IX /></button>
        </div>
        <div className="scroll flex-1 min-h-0">
          {items === null ? (
            <div className="text-ink-300 text-sm p-6 text-center animate-pulse">Loading…</div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed hairline p-8 text-center text-sm text-ink-300">No saved designs yet. Hit Save in the top bar.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {items.map((d) => {
                const b = blankById(d.blank);
                return (
                  <div key={d.id} className="rounded-2xl border hairline bg-black/30 overflow-hidden group">
                    <button className="w-full aspect-square bg-black/40 grid place-items-center overflow-hidden" onClick={() => onLoad(d)}>
                      {d.thumbnail ? <img src={d.thumbnail} alt={d.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <span className="text-ink-300 text-xs">No preview</span>}
                    </button>
                    <div className="p-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold truncate">{d.name}</div>
                        <div className="text-[10.5px] text-ink-300">{b.label} {b.view} · {new Date(d.updatedAt).toLocaleDateString()}</div>
                      </div>
                      <button className="btn btn-sm btn-ghost btn-danger" title="Delete" onClick={() => deleteDesign(d.id, d.source).then(refresh).catch((e) => onError(e.message))}><ITrash /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
