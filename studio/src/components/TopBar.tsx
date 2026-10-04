import type { StoreApi } from "../engine/store";
import { IDownload, IFolder, IPlus, IRedo, ISave, IUndo } from "./icons";

interface Props {
  store: StoreApi;
  saving: boolean;
  onSave: () => void;
  onExport: () => void;
  onOpenSaved: () => void;
  onNew: () => void;
}

export function TopBar({ store, saving, onSave, onExport, onOpenSaved, onNew }: Props) {
  const { state, rename, undo, redo } = store;
  return (
    <header className="glass rounded-2xl px-3 sm:px-4 flex items-center gap-2 sm:gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg grid place-items-center" style={{ background: "linear-gradient(135deg,#7c5cff,#f5a524)", boxShadow: "0 0 18px rgba(124,92,255,.6)" }}>
          <svg width="18" height="18" viewBox="0 0 64 64"><path d="M20 18h24l6 8-7 4v18H21V30l-7-4z" fill="#0a0b11" /></svg>
        </div>
        <div className="leading-none">
          <div className="wordmark">Apparel Studio</div>
          <div className="eyebrow mt-1 hidden sm:block">Hats · Tees · Print-ready</div>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-1 ml-2">
        <button className="btn btn-icon btn-ghost" title="Undo (⌘Z)" disabled={!state.past.length} onClick={undo}><IUndo /></button>
        <button className="btn btn-icon btn-ghost" title="Redo (⌘⇧Z)" disabled={!state.future.length} onClick={redo}><IRedo /></button>
      </div>

      <div className="flex-1 min-w-0 hidden sm:flex justify-center">
        <input
          className="field max-w-[260px] text-center font-semibold bg-transparent border-transparent hover:border-[var(--panel-border)]"
          value={state.design.name}
          onChange={(e) => rename(e.target.value)}
          aria-label="Design name"
        />
      </div>

      <div className="flex items-center gap-2">
        <button className="btn btn-ghost hidden sm:inline-flex" onClick={onNew} title="New design"><IPlus /><span className="hidden lg:inline">New</span></button>
        <button className="btn btn-ghost" onClick={onOpenSaved} title="Saved designs"><IFolder /><span className="hidden lg:inline">Saved</span></button>
        <button className="btn" onClick={onSave} disabled={saving} title="Save design">
          <ISave />
          <span className="hidden sm:inline">{saving ? "Saving…" : state.dirty ? "Save" : "Saved"}</span>
        </button>
        <button className="btn btn-primary" onClick={onExport}><IDownload /> Export</button>
      </div>
    </header>
  );
}
