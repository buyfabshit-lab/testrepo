import { useCallback, useEffect, useState } from "react";
import { ExportModal } from "./components/ExportModal";
import { Inspector } from "./components/Inspector";
import { SavedDrawer } from "./components/SavedDrawer";
import { SidePanel } from "./components/SidePanel";
import { Stage } from "./components/Stage";
import { Toast, type ToastMsg } from "./components/Toast";
import { TopBar } from "./components/TopBar";
import { normalizeUpload } from "./engine/images";
import { renderMockup } from "./engine/render";
import { newDesign, useDesignStore } from "./engine/store";
import { ensureFont, FONTS, fontsSettled, measureText } from "./engine/text";
import { saveDesign, type SavedDesign } from "./lib/designs";
import { ensureSession, supabaseConfigured } from "./lib/supabase";

type Cloud = "off" | "connecting" | "on" | "error";

export default function App() {
  const store = useDesignStore();
  const { state, addImage, select, remove, duplicate, undo, redo, updateLayer, replace, markSaved } = store;
  const [showExport, setShowExport] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [cloud, setCloud] = useState<Cloud>(supabaseConfigured ? "connecting" : "off");

  const notify = useCallback((text: string, tone: "ok" | "error" = "ok") => setToast({ id: Date.now(), text, tone }), []);
  const onError = useCallback((m: string) => notify(m, "error"), [notify]);

  // Warm the display fonts so the first text layer rasterizes correctly.
  useEffect(() => {
    FONTS.forEach((f) => f.weights.forEach((w) => ensureFont({ fontFamily: f.family, fontWeight: w, fontSize: 64 })));
  }, []);

  // Text measured before its webfont arrived has the wrong box; re-measure on load.
  useEffect(() => {
    const remeasure = () => {
      for (const l of state.design.layers) {
        if (l.kind !== "text") continue;
        const m = measureText(l);
        if (Math.abs(m.w - l.naturalW) > 1 || Math.abs(m.h - l.naturalH) > 1) updateLayer(l.id, { naturalW: m.w, naturalH: m.h }, true);
      }
    };
    document.fonts.addEventListener("loadingdone", remeasure);
    return () => document.fonts.removeEventListener("loadingdone", remeasure);
  }, [state.design.layers, updateLayer]);

  useEffect(() => {
    if (!supabaseConfigured) return;
    ensureSession().then((id) => setCloud(id ? "on" : "error"));
  }, []);

  const onFiles = useCallback(
    async (files: File[]) => {
      for (const f of files) {
        try {
          const { src, w, h } = await normalizeUpload(f);
          addImage(src, w, h, f.name.replace(/\.[^.]+$/, ""));
        } catch {
          notify(`Couldn't read ${f.name}`, "error");
        }
      }
    },
    [addImage, notify],
  );

  // Keyboard shortcuts (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      const sel = state.design.layers.find((l) => l.id === state.selectedId);
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === "d" && sel) { e.preventDefault(); duplicate(sel.id); return; }
      if (mod && e.key.toLowerCase() === "e") { e.preventDefault(); setShowExport(true); return; }
      if (e.key === "Escape") { select(null); return; }
      if (!sel || sel.locked) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(sel.id); return; }
      const step = e.shiftKey ? 100 : 10;
      const nudge: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (nudge[e.key]) { e.preventDefault(); const [dx, dy] = nudge[e.key]; updateLayer(sel.id, { x: sel.x + dx, y: sel.y + dy }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.design.layers, state.selectedId, undo, redo, duplicate, remove, select, updateLayer]);

  const onSave = useCallback(async () => {
    setSaving(true);
    try {
      await fontsSettled();
      const thumb = await renderMockup(state.design, { size: 640, backdrop: "studio" });
      const { mode, layers } = await saveDesign(state.design, thumb.blob);
      // Swap inline uploads for their storage URLs without creating an undo step.
      if (layers !== state.design.layers) replace({ ...state.design, layers });
      markSaved();
      notify(mode === "cloud" ? "Saved to your cloud library" : "Saved on this device");
    } catch (e) {
      onError(e instanceof Error ? `Save failed: ${e.message}` : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [state.design, replace, markSaved, notify, onError]);

  const onLoad = useCallback(
    (d: SavedDesign) => {
      replace({ id: d.id, name: d.name, blank: d.blank, color: d.color, layers: d.layers, updatedAt: d.updatedAt });
      setShowSaved(false);
      notify(`Opened “${d.name}”`);
    },
    [replace, notify],
  );

  const onNew = useCallback(() => {
    if (state.dirty && !confirm("Start a new design? Unsaved changes will be lost.")) return;
    replace(newDesign(state.design.blank, state.design.color));
  }, [state.dirty, state.design.blank, state.design.color, replace]);

  const cloudLabel = cloud === "on" ? "Cloud sync on" : cloud === "connecting" ? "Connecting…" : cloud === "error" ? "Cloud unavailable · saving locally" : "Local mode";
  const cloudTone = cloud === "on" ? "live" : cloud === "error" ? "amber" : "violet";

  return (
    <>
      <div className="backdrop" />
      <div className="app fade-in">
        <div className="top"><TopBar store={store} saving={saving} onSave={onSave} onExport={() => setShowExport(true)} onOpenSaved={() => setShowSaved(true)} onNew={onNew} /></div>
        <div className="left min-h-0"><SidePanel store={store} onFiles={onFiles} /></div>
        <div className="stagewrap min-h-0 glass rounded-2xl overflow-hidden"><Stage store={store} onDropFiles={onFiles} cloudLabel={cloudLabel} cloudTone={cloudTone} /></div>
        <div className="right min-h-0"><Inspector store={store} /></div>
      </div>
      {showExport && <ExportModal design={state.design} onClose={() => setShowExport(false)} onError={onError} />}
      {showSaved && <SavedDrawer onClose={() => setShowSaved(false)} onLoad={onLoad} onError={onError} />}
      <Toast msg={toast} onDone={() => setToast(null)} />
    </>
  );
}
