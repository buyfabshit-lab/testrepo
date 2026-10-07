"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  ActiveSelection, Canvas, FabricImage, FabricObject, Group, IText, Path, Pattern, Rect, loadSVGFromString, util,
} from "fabric";
import { CAMO_KINDS, CAMO_LABELS, camoDataUrl, camoTile, type CamoKind } from "./camo";
import {
  BLANKS, COLORS, LOCATION_LABELS, PRINT_DPI, PX_PER_IN, areaRect, fallbackSvg, svgDataUrl, type BlankKey, type Location,
} from "./blanks";

/* ---------------------------------------------------------------- types */

type Tab = "vault" | "camo" | "text" | "upload" | "tools";
type PlObject = FabricObject & {
  plRole?: "guide" | "waterline";
  plVaultId?: string;
  plArc?: number;
  plLocked?: boolean;
  plKind?: "image" | "svg" | "text" | "shape";
};
type VaultAsset = { id: string; title: string | null; brand: string | null; tags: string[] | null; thumb: string | null; url?: string | null; dpi?: number | null };
type Saved = { design_id: string | null; file_name: string | null; dpi_warning: string | null };
type Quote = { raw: Record<string, unknown>; total: number | null; unit: number | null; id: string | null };
type SelInfo = { count: number; kind: PlObject["plKind"] | null; dpi: number | null; locked: boolean; arc: number; isText: boolean };

/** Custom props kept in studio_json so a saved design re-opens exactly as left. */
const PROPS = ["plRole", "plVaultId", "plArc", "plLocked", "plKind", "selectable", "evented"];
const FONTS = ["Impact", "Georgia", "Arial Black", "Courier New"];
const EMAIL_KEY = "pl_customer_email";
const MAX_HISTORY = 60;

const isSystem = (o: FabricObject) => Boolean((o as PlObject).plRole);

/* ---------------------------------------------------------------- component */

export function Studio() {
  const hostEl = useRef<HTMLDivElement>(null);
  const stageEl = useRef<HTMLDivElement>(null);
  const fcRef = useRef<Canvas | null>(null);
  const guideRef = useRef<Rect | null>(null);
  const bgRef = useRef<FabricImage | null>(null);
  const restoring = useRef(false);
  const undoRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);
  const loadToken = useRef(0);
  const photoCache = useRef(new Map<string, { front: string | null; back: string | null }>());

  const [blank, setBlank] = useState<BlankKey>("tee");
  const [location, setLocation] = useState<Location>("front");
  const [colorIdx, setColorIdx] = useState(0);
  const [camo, setCamo] = useState<CamoKind | null>(null);
  const [waterline, setWaterline] = useState(false);
  const [waterlineMode, setWaterlineMode] = useState<"camo" | "color">("camo");
  const [waterlineColor, setWaterlineColor] = useState("#1c2541");
  const [photoSource, setPhotoSource] = useState<"ss" | "fallback">("fallback");

  const [tab, setTab] = useState<Tab>("text");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [hist, setHist] = useState({ undo: 0, redo: 0 });
  const [sel, setSel] = useState<SelInfo>({ count: 0, kind: null, dpi: null, locked: false, arc: 0, isText: false });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [email, setEmail] = useState<string>("");
  const [askEmail, setAskEmail] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [qty, setQty] = useState(24);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteSent, setQuoteSent] = useState(false);

  const color = COLORS[colorIdx];
  const def = BLANKS[blank];
  const area = areaRect(blank, location);

  /* ------------------------------------------------------------ helpers */

  const flash = useCallback((msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus((s) => (s === msg ? null : s)), 3500);
  }, []);

  const clipFor = useCallback((b: BlankKey, loc: Location) => {
    const a = areaRect(b, loc);
    return new Rect({ left: a.left, top: a.top, width: a.width, height: a.height, absolutePositioned: true });
  }, []);

  const systemCount = useCallback(() => {
    const fc = fcRef.current;
    return fc ? fc.getObjects().filter(isSystem).length : 0;
  }, []);

  const fitToContainer = useCallback(() => {
    const fc = fcRef.current, el = stageEl.current;
    if (!fc || !el) return;
    const logical = BLANKS[blank].canvas;
    const w = el.clientWidth || logical.w;
    const scale = Math.max(0.3, Math.min(1.15, w / logical.w));
    fc.setDimensions({ width: logical.w * scale, height: logical.h * scale });
    fc.setZoom(scale);
    fc.requestRenderAll();
  }, [blank]);

  const refreshSel = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    const objs = fc.getActiveObjects() as PlObject[];
    const one = objs.length === 1 ? objs[0] : null;
    let dpi: number | null = null;
    const img: FabricImage | null = one && one.plKind === "image" && one instanceof FabricImage ? one : null;
    if (img) {
      const inches = img.getScaledWidth() / PX_PER_IN;
      dpi = inches > 0 ? Math.round(img.width / inches) : null;
    }
    setSel({
      count: objs.length,
      kind: one?.plKind ?? null,
      dpi,
      locked: Boolean(one?.plLocked),
      arc: one?.plArc ?? 0,
      isText: Boolean(one && one instanceof IText),
    });
  }, []);

  const snapshot = useCallback(() => {
    const fc = fcRef.current;
    if (!fc || restoring.current) return;
    const json = JSON.stringify(fc.toObject(PROPS));
    const stack = undoRef.current;
    if (stack[stack.length - 1] === json) return;
    stack.push(json);
    if (stack.length > MAX_HISTORY) stack.shift();
    redoRef.current = [];
    setHist({ undo: stack.length, redo: 0 });
  }, []);

  const drawGuide = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    if (guideRef.current) fc.remove(guideRef.current);
    const a = areaRect(blank, location);
    const guide = new Rect({
      left: a.left, top: a.top, width: a.width, height: a.height,
      fill: "transparent", stroke: "#d4a94f", strokeWidth: 1, strokeDashArray: [6, 4],
      selectable: false, evented: false, excludeFromExport: true, objectCaching: false,
    });
    (guide as PlObject).plRole = "guide";
    guideRef.current = guide;
    fc.insertAt(Math.min(1, fc.getObjects().length), guide);
  }, [blank, location]);

  const reclipAll = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    for (const o of fc.getObjects()) {
      if ((o as PlObject).plRole === "guide") continue;
      o.clipPath = clipFor(blank, location);
      o.dirty = true;
    }
  }, [blank, location, clipFor]);

  const waterlineFill = useCallback((): Pattern | string => {
    if (waterlineMode === "camo" && camo) return new Pattern({ source: camoTile(camo), repeat: "repeat" });
    return waterlineColor;
  }, [waterlineMode, camo, waterlineColor]);

  const syncWaterline = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    const existing = fc.getObjects().find((o) => (o as PlObject).plRole === "waterline") as Rect | undefined;
    if (!waterline) {
      if (existing) fc.remove(existing);
      return;
    }
    const a = areaRect(blank, location);
    if (existing) {
      existing.set({ left: a.left, top: a.top, width: a.width, height: a.height, fill: waterlineFill() });
      existing.setCoords();
    } else {
      const r = new Rect({
        left: a.left, top: a.top, width: a.width, height: a.height, fill: waterlineFill(),
        selectable: false, evented: false, objectCaching: false,
      });
      (r as PlObject).plRole = "waterline";
      fc.insertAt(0, r);
    }
    fc.requestRenderAll();
  }, [waterline, blank, location, waterlineFill]);

  const restore = useCallback(async (json: string) => {
    const fc = fcRef.current;
    if (!fc) return;
    restoring.current = true;
    try {
      await fc.loadFromJSON(json);
      fc.backgroundImage = bgRef.current ?? undefined;
      guideRef.current = null;
      drawGuide();
      reclipAll();
      fc.requestRenderAll();
      setWaterline(fc.getObjects().some((o) => (o as PlObject).plRole === "waterline"));
    } finally {
      restoring.current = false;
      refreshSel();
    }
  }, [drawGuide, reclipAll, refreshSel]);

  const undo = useCallback(async () => {
    if (undoRef.current.length < 2) return;
    redoRef.current.push(undoRef.current.pop()!);
    await restore(undoRef.current[undoRef.current.length - 1]);
    setHist({ undo: undoRef.current.length, redo: redoRef.current.length });
  }, [restore]);

  const redo = useCallback(async () => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(next);
    await restore(next);
    setHist({ undo: undoRef.current.length, redo: redoRef.current.length });
  }, [restore]);

  /** Drop a new object into the print area, scaled to fit, select it, snapshot. */
  const place = useCallback((obj: FabricObject, kind: PlObject["plKind"], maxFrac = 0.85) => {
    const fc = fcRef.current;
    if (!fc) return;
    const a = areaRect(blank, location);
    const w = obj.getScaledWidth(), h = obj.getScaledHeight();
    const s = Math.min((a.width * maxFrac) / w, (a.height * maxFrac) / h, 1);
    obj.scale(obj.scaleX * s);
    obj.set({ left: a.left + a.width / 2, top: a.top + a.height / 2, originX: "center", originY: "center" });
    (obj as PlObject).plKind = kind;
    obj.clipPath = clipFor(blank, location);
    obj.setCoords();
    fc.add(obj);
    fc.setActiveObject(obj);
    fc.requestRenderAll();
    snapshot();
  }, [blank, location, clipFor, snapshot]);

  /* ------------------------------------------------------------ canvas lifecycle */

  useEffect(() => {
    const host = hostEl.current;
    if (!host) return;
    // Each mount gets its own wrapper + <canvas>, so React strict-mode's double mount and
    // fabric's async dispose() never fight over the same element.
    const wrap = document.createElement("div");
    const el = document.createElement("canvas");
    wrap.appendChild(el);
    host.appendChild(wrap);
    const fc = new Canvas(el, { preserveObjectStacking: true, selection: true, backgroundColor: "transparent" });
    fcRef.current = fc;
    const onChange = () => { snapshot(); refreshSel(); };
    fc.on("object:added", onChange);
    fc.on("object:modified", onChange);
    fc.on("object:removed", onChange);
    fc.on("text:editing:exited", onChange);
    fc.on("object:scaling", refreshSel);
    fc.on("selection:created", refreshSel);
    fc.on("selection:updated", refreshSel);
    fc.on("selection:cleared", refreshSel);
    try { setEmail(window.localStorage.getItem(EMAIL_KEY) ?? ""); } catch { /* private mode */ }
    return () => {
      fcRef.current = null;
      fc.dispose().catch(() => undefined).finally(() => wrap.remove());
    };
  }, [snapshot, refreshSel]);

  // Keyboard: delete / undo / redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const fc = fcRef.current;
      if (!fc) return;
      if ((e.key === "Delete" || e.key === "Backspace") && fc.getActiveObjects().length) {
        const editing = fc.getActiveObjects().some((o) => o instanceof IText && o.isEditing);
        if (editing) return;
        e.preventDefault();
        fc.getActiveObjects().forEach((o) => fc.remove(o));
        fc.discardActiveObject();
        fc.requestRenderAll();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) void redo(); else void undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Responsive sizing
  useEffect(() => {
    fitToContainer();
    const el = stageEl.current;
    if (!el) return;
    const ro = new ResizeObserver(() => fitToContainer());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitToContainer]);

  // Blank photo + guide + clips whenever blank / side / colour changes
  useEffect(() => {
    const fc = fcRef.current;
    if (!fc) return;
    const token = ++loadToken.current;
    const side = def.photoFor(location);
    const key = `${def.style}:${color.ss}`;

    async function photos(): Promise<{ front: string | null; back: string | null }> {
      const hit = photoCache.current.get(key);
      if (hit) return hit;
      let out = { front: null as string | null, back: null as string | null };
      try {
        const r = await fetch(`/api/blanks?supplier=ss&style=${encodeURIComponent(def.style)}&color=${encodeURIComponent(color.ss)}`);
        if (r.ok) {
          const j = (await r.json()) as unknown;
          const rows: unknown[] = Array.isArray(j) ? j
            : j && typeof j === "object"
              ? ((j as Record<string, unknown>).blanks as unknown[]) ?? ((j as Record<string, unknown>).rows as unknown[]) ?? ((j as Record<string, unknown>).data as unknown[])
                ?? ((j as Record<string, unknown>).blank ? [(j as Record<string, unknown>).blank] : [])
              : [];
          const row = rows.find((x) => x && typeof x === "object" && (x as Record<string, unknown>).photo_front) as Record<string, unknown> | undefined;
          if (row) out = { front: (row.photo_front as string) ?? null, back: (row.photo_back as string) ?? null };
        }
      } catch { /* offline / staff-only — fall back */ }
      photoCache.current.set(key, out);
      return out;
    }

    async function loadImg(url: string, cors: boolean) {
      return FabricImage.fromURL(url, cors ? { crossOrigin: "anonymous" } : {});
    }

    (async () => {
      const p = await photos();
      const url = side === "back" ? p.back ?? p.front : p.front;
      let img: FabricImage | null = null;
      let source: "ss" | "fallback" = "fallback";
      if (url) {
        try { img = await loadImg(url, true); source = "ss"; }
        catch { try { img = await loadImg(url, false); source = "ss"; } catch { img = null; } }
      }
      if (!img) img = await loadImg(svgDataUrl(fallbackSvg(blank, side, color.hex)), false);
      if (token !== loadToken.current || !fcRef.current) return;
      const { w, h } = def.canvas;
      const s = Math.min(w / img.width, h / img.height);
      img.set({ scaleX: s, scaleY: s, left: w / 2, top: h / 2, originX: "center", originY: "center", selectable: false, evented: false, excludeFromExport: true });
      bgRef.current = img;
      fc.backgroundImage = img;
      setPhotoSource(source);
      fc.requestRenderAll();
    })();

    drawGuide();
    reclipAll();
    fitToContainer();
    fc.requestRenderAll();
    if (!undoRef.current.length) snapshot();
  }, [blank, location, colorIdx, color, def, drawGuide, reclipAll, fitToContainer, snapshot]);

  useEffect(() => { syncWaterline(); }, [syncWaterline]);

  /* ------------------------------------------------------------ object actions */

  const active = () => fcRef.current?.getActiveObject() as PlObject | undefined;

  function del() {
    const fc = fcRef.current; if (!fc) return;
    fc.getActiveObjects().forEach((o) => fc.remove(o));
    fc.discardActiveObject();
    fc.requestRenderAll();
  }

  async function duplicate() {
    const fc = fcRef.current; if (!fc) return;
    const objs = fc.getActiveObjects();
    if (!objs.length) return;
    fc.discardActiveObject();
    const clones: FabricObject[] = [];
    for (const o of objs) {
      const c = await o.clone(PROPS);
      c.set({ left: (o.left ?? 0) + 18, top: (o.top ?? 0) + 18 });
      c.clipPath = clipFor(blank, location);
      c.setCoords();
      fc.add(c);
      clones.push(c);
    }
    fc.setActiveObject(clones.length === 1 ? clones[0] : new ActiveSelection(clones, { canvas: fc }));
    fc.requestRenderAll();
  }

  function forward() {
    const fc = fcRef.current, o = active(); if (!fc || !o) return;
    fc.bringObjectForward(o); fc.requestRenderAll(); snapshot();
  }

  function backward() {
    const fc = fcRef.current, o = active(); if (!fc || !o) return;
    fc.sendObjectBackwards(o);
    const min = systemCount();
    if (fc.getObjects().indexOf(o) < min) fc.moveObjectTo(o, min);
    fc.requestRenderAll(); snapshot();
  }

  function toggleLock() {
    const fc = fcRef.current, o = active(); if (!fc || !o) return;
    const locked = !o.plLocked;
    o.set({ lockMovementX: locked, lockMovementY: locked, lockScalingX: locked, lockScalingY: locked, lockRotation: locked, hasControls: !locked });
    o.plLocked = locked;
    fc.requestRenderAll(); snapshot(); refreshSel();
  }

  /* ------------------------------------------------------------ vault */

  const [vq, setVq] = useState("");
  const [vbrand, setVbrand] = useState("");
  const [vtags, setVtags] = useState("");
  const [vault, setVault] = useState<VaultAsset[]>([]);
  const [vaultMsg, setVaultMsg] = useState<string | null>(null);

  async function searchVault() {
    setBusy("vault"); setVaultMsg(null);
    try {
      const qs = new URLSearchParams({ q: vq, brand: vbrand, tags: vtags });
      const r = await fetch(`/api/vault?${qs.toString()}`);
      if (r.status === 401 || r.status === 403) { setVault([]); setVaultMsg("The Vault is locked for guests. Upload your own art or ask Justin to unlock a brand."); return; }
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { total?: number; assets?: VaultAsset[] };
      setVault(j.assets ?? []);
      if (!(j.assets ?? []).length) setVaultMsg("Nothing in the Vault for that. Try another word.");
    } catch {
      setVault([]); setVaultMsg("Couldn't reach the Vault.");
    } finally { setBusy(null); }
  }

  async function addVault(a: VaultAsset) {
    const url = a.url ?? a.thumb;
    if (!url) { flash("That asset has no preview yet."); return; }
    setBusy("add");
    try {
      let img: FabricImage;
      try { img = await FabricImage.fromURL(url, { crossOrigin: "anonymous" }); }
      catch { img = await FabricImage.fromURL(url); }
      (img as PlObject).plVaultId = a.id;
      place(img, "image");
      setSheetOpen(false);
    } catch { flash("Couldn't load that image."); }
    finally { setBusy(null); }
  }

  /* ------------------------------------------------------------ camo */

  function applyCamo(kind: CamoKind) {
    setCamo(kind);
    const fc = fcRef.current, o = active();
    if (!fc || !o) { if (!waterline) flash(`${CAMO_LABELS[kind]} picked — select text or a shape to fill it, or flip WATERLINE on.`); return; }
    const pattern = () => new Pattern({ source: camoTile(kind), repeat: "repeat" });
    if (o instanceof FabricImage) { flash("Images can't take a fill. Pick text or a shape, or use WATERLINE."); return; }
    if (o instanceof Group) o.getObjects().forEach((c) => { if (!(c instanceof FabricImage)) c.set("fill", pattern()); c.dirty = true; });
    else o.set("fill", pattern());
    o.dirty = true;
    fc.requestRenderAll(); snapshot();
  }

  function addCamoBlock() {
    const kind = camo ?? "woodland";
    setCamo(kind);
    const r = new Rect({ width: area.width * 0.6, height: area.height * 0.35, fill: new Pattern({ source: camoTile(kind), repeat: "repeat" }) });
    place(r, "shape", 0.7);
    setSheetOpen(false);
  }

  /* ------------------------------------------------------------ text */

  const [textValue, setTextValue] = useState("DEATH SQUAD");
  const [font, setFont] = useState(FONTS[0]);
  const [fillColor, setFillColor] = useState("#efe6d2");

  function addText() {
    const t = new IText(textValue.trim() || "YOUR TEXT", { fontFamily: font, fontSize: 56, fontWeight: "bold", fill: fillColor, textAlign: "center", charSpacing: 20 });
    place(t, "text", 0.9);
    setSheetOpen(false);
  }

  /** Bend text along a circle: build an arc path whose length equals the text width. */
  function applyArc(deg: number) {
    const fc = fcRef.current, o = active();
    if (!fc || !o || !(o instanceof IText)) return;
    const t = o as IText & PlObject;
    if (Math.abs(deg) < 2) {
      t.set({ path: undefined });
      t.plArc = 0;
    } else {
      const len = t.calcTextWidth();
      const theta = (Math.abs(deg) * Math.PI) / 180;
      const r = len / theta;
      const sx = -r * Math.sin(theta / 2), ex = r * Math.sin(theta / 2);
      const large = theta > Math.PI ? 1 : 0;
      const d = deg > 0
        ? `M ${sx} ${-r * Math.cos(theta / 2)} A ${r} ${r} 0 ${large} 1 ${ex} ${-r * Math.cos(theta / 2)}`
        : `M ${sx} ${r * Math.cos(theta / 2)} A ${r} ${r} 0 ${large} 0 ${ex} ${r * Math.cos(theta / 2)}`;
      const path = new Path(d, { fill: "", stroke: "", visible: false });
      t.set({ path, pathAlign: "center", pathSide: "left" });
      t.plArc = deg;
    }
    t.dirty = true;
    t.setCoords();
    fc.requestRenderAll();
    setSel((s) => ({ ...s, arc: deg }));
  }

  function setTextProp(k: "fontFamily" | "fill", v: string) {
    const fc = fcRef.current, o = active();
    if (!fc || !o || !(o instanceof IText)) return;
    o.set(k, v); o.dirty = true; fc.requestRenderAll(); snapshot();
  }

  /* ------------------------------------------------------------ upload */

  async function loadFile(file: File) {
    setBusy("upload");
    try {
      if (file.type === "image/svg+xml" || /\.svg$/i.test(file.name)) {
        const text = await file.text();
        const { objects, options } = await loadSVGFromString(text);
        const parts = objects.filter((o): o is FabricObject => Boolean(o));
        if (!parts.length) throw new Error("empty svg");
        const g = util.groupSVGElements(parts, options);
        place(g, "svg");
      } else if (/^image\/(png|jpe?g|webp)$/.test(file.type)) {
        const dataUrl = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(file); });
        const img = await FabricImage.fromURL(dataUrl);
        place(img, "image");
      } else {
        flash("PNG, JPG or SVG only.");
        return;
      }
      setSheetOpen(false);
    } catch { flash("Couldn't read that file."); }
    finally { setBusy(null); }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void loadFile(f);
  }

  /* ------------------------------------------------------------ imaging tools */

  async function imaging(route: "bg-remove" | "distress") {
    const fc = fcRef.current, o = active();
    if (!fc || !o || !(o instanceof FabricImage)) { flash("Select an image first."); return; }
    setBusy(route);
    try {
      const el = o.getElement() as HTMLImageElement | HTMLCanvasElement;
      const c = document.createElement("canvas");
      c.width = o.width; c.height = o.height;
      c.getContext("2d")!.drawImage(el, 0, 0, o.width, o.height);
      const png_base64 = c.toDataURL("image/png").split(",")[1];
      const r = await fetch(`/api/imaging/${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ png_base64 }) });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { png_base64?: string };
      if (!j.png_base64) throw new Error("no image");
      await o.setSrc(`data:image/png;base64,${j.png_base64}`);
      o.dirty = true; o.setCoords();
      fc.requestRenderAll(); snapshot(); refreshSel();
      flash(route === "bg-remove" ? "Background gone." : "Distressed.");
    } catch (e) {
      flash(`${route === "bg-remove" ? "BG remove" : "Distress"} failed (${(e as Error).message}).`);
    } finally { setBusy(null); }
  }

  /* ------------------------------------------------------------ save + quote */

  /** Print area → 300 DPI PNG with the blank photo and guide hidden. */
  function exportPrintPng(): string {
    const fc = fcRef.current!;
    const a = areaRect(blank, location);
    const zoom = fc.getZoom(), w = fc.getWidth(), h = fc.getHeight();
    const bg = fc.backgroundImage;
    fc.discardActiveObject();
    fc.backgroundImage = undefined;
    fc.setZoom(1);
    fc.setDimensions({ width: def.canvas.w, height: def.canvas.h });
    try {
      return fc.toDataURL({
        format: "png", multiplier: PRINT_DPI / PX_PER_IN, enableRetinaScaling: false,
        left: a.left, top: a.top, width: a.width, height: a.height,
        filter: (o) => (o as PlObject).plRole !== "guide",
      }).split(",")[1];
    } finally {
      fc.backgroundImage = bg;
      fc.setDimensions({ width: w, height: h });
      fc.setZoom(zoom);
      fc.requestRenderAll();
    }
  }

  function rememberEmail(v: string) {
    const e = v.trim();
    setEmail(e);
    try { window.localStorage.setItem(EMAIL_KEY, e); } catch { /* ignore */ }
  }

  async function save() {
    const fc = fcRef.current; if (!fc) return;
    if (!email) { setAskEmail(true); return; }
    if (!fc.getObjects().some((o) => !isSystem(o)) && !waterline) { flash("Put something in the print area first."); return; }
    setBusy("save"); setSaved(null); setQuote(null); setQuoteSent(false);
    try {
      const print_png_base64 = exportPrintPng();
      const studio_json = {
        ...(fc.toObject(PROPS) as Record<string, unknown>),
        pressline: { blank, blank_style: def.style, color: color.name, color_hex: color.hex, location, camo, waterline, waterline_mode: waterlineMode, waterline_color: waterlineColor, px_per_in: PX_PER_IN },
      };
      const vault_asset_ids = Array.from(new Set(fc.getObjects().map((o) => (o as PlObject).plVaultId).filter((v): v is string => Boolean(v))));
      const r = await fetch("/api/designs", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customer_email: email, studio_json, print_png_base64,
          width_in: area.inW, height_in: area.inH, method: "dtf", locations: [location], brand: null,
          blank_style: def.style, blank_color: color.ss, vault_asset_ids,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { design?: { id?: string }; file_name?: string; dpi_warning?: string; error?: string };
      if (!r.ok) throw new Error(j.error ?? String(r.status));
      setSaved({ design_id: j.design?.id ?? null, file_name: j.file_name ?? null, dpi_warning: j.dpi_warning ?? null });
      flash("Saved. File's in the vault.");
    } catch (e) {
      flash(`Save failed (${(e as Error).message}).`);
    } finally { setBusy(null); }
  }

  async function instantQuote() {
    if (!saved?.design_id) return;
    setBusy("quote"); setQuoteSent(false);
    try {
      const r = await fetch("/api/quotes/instant", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ design_id: saved.design_id, qty, blank_style: def.style, blank_color: color.ss, method: "dtf" }),
      });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : String(r.status));
      const q = (j.quote && typeof j.quote === "object" ? j.quote : j) as Record<string, unknown>;
      const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);
      const total = num(q.total);
      setQuote({ raw: j, total, unit: num(q.unit) ?? (total != null && qty ? Math.round((total / qty) * 100) / 100 : null), id: typeof q.id === "string" ? q.id : null });
    } catch (e) {
      flash(`Quote failed (${(e as Error).message}).`);
    } finally { setBusy(null); }
  }

  async function sendQuote() {
    if (!saved?.design_id) return;
    setBusy("send");
    try {
      const r = await fetch("/api/quotes/instant/send", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ quote_id: quote?.id ?? null, design_id: saved.design_id, email, qty, blank_style: def.style, blank_color: color.ss, method: "dtf" }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setQuoteSent(true);
    } catch (e) {
      flash(`Couldn't send (${(e as Error).message}).`);
    } finally { setBusy(null); }
  }

  /* ------------------------------------------------------------ render */

  const tabs: Array<[Tab, string]> = [["vault", "Vault"], ["camo", "Camo"], ["text", "Text"], ["upload", "Upload"], ["tools", "Tools"]];
  const chip = (on: boolean) => `px-3 py-1.5 text-[11px] uppercase tracking-widest border ${on ? "border-mf-gold bg-mf-gold text-mf-bg" : "border-mf-line text-mf-muted hover:border-mf-gold"}`;
  const tool = "btn px-2.5 py-1.5 text-[11px]";

  const rail = (
    <div className="p-4">
      {tab === "vault" && (
        <div className="grid gap-3">
          <p className="text-xs text-mf-muted">Search the Vault. Click a tile to drop it on the blank.</p>
          <input className="input" placeholder="Search (skulls, flames, 1%…)" value={vq} onChange={(e) => setVq(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchVault()} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Brand" value={vbrand} onChange={(e) => setVbrand(e.target.value)} />
            <input className="input" placeholder="Tags a,b" value={vtags} onChange={(e) => setVtags(e.target.value)} />
          </div>
          <button className="btn" onClick={searchVault} disabled={busy === "vault"}>{busy === "vault" ? "Searching…" : "Search"}</button>
          {vaultMsg && <p className="text-xs text-mf-dim">{vaultMsg}</p>}
          <div className="grid grid-cols-3 gap-2">
            {vault.map((a) => (
              <button key={a.id} onClick={() => addVault(a)} className="panel aspect-square overflow-hidden p-1 hover:border-mf-gold" title={a.title ?? ""}>
                {a.thumb
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={a.thumb} alt={a.title ?? ""} className="h-full w-full object-contain" />
                  : <span className="text-[10px] text-mf-dim">{a.title ?? "asset"}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "camo" && (
        <div className="grid gap-3">
          <p className="text-xs text-mf-muted">Fill selected text or shapes, or flood the print area with WATERLINE.</p>
          <div className="grid grid-cols-3 gap-2">
            {CAMO_KINDS.map((k) => (
              <button key={k} onClick={() => applyCamo(k)} className={`overflow-hidden border ${camo === k ? "border-mf-gold" : "border-mf-line"}`} title={CAMO_LABELS[k]}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={camoDataUrl(k)} alt={CAMO_LABELS[k]} className="aspect-square w-full object-cover" />
                <span className="block py-1 text-[10px] uppercase tracking-widest text-mf-muted">{CAMO_LABELS[k]}</span>
              </button>
            ))}
          </div>
          <button className="btn" onClick={addCamoBlock}>Add camo block</button>
          <div className="panel p-3">
            <label className="flex items-center justify-between text-sm">
              <span className="font-display text-base uppercase tracking-widest text-mf-gold">Waterline</span>
              <input type="checkbox" className="accent-mf-gold" checked={waterline} onChange={(e) => setWaterline(e.target.checked)} />
            </label>
            <p className="mt-1 text-xs text-mf-dim">Floods the whole print area behind everything.</p>
            <div className="mt-3 flex items-center gap-2">
              <button className={chip(waterlineMode === "camo")} onClick={() => setWaterlineMode("camo")}>Camo</button>
              <button className={chip(waterlineMode === "color")} onClick={() => setWaterlineMode("color")}>Colour</button>
              <input type="color" value={waterlineColor} onChange={(e) => setWaterlineColor(e.target.value)} className="h-8 w-10 cursor-pointer border border-mf-line bg-transparent" aria-label="Waterline colour" />
            </div>
            {waterlineMode === "camo" && !camo && waterline && <p className="mt-2 text-xs text-mf-gold">Pick a camo above.</p>}
          </div>
        </div>
      )}

      {tab === "text" && (
        <div className="grid gap-3">
          <input className="input" value={textValue} onChange={(e) => setTextValue(e.target.value)} placeholder="Your text" />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <select className="input" value={font} onChange={(e) => { setFont(e.target.value); setTextProp("fontFamily", e.target.value); }}>
              {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
            </select>
            <input type="color" value={fillColor} onChange={(e) => { setFillColor(e.target.value); setTextProp("fill", e.target.value); }} className="h-10 w-12 cursor-pointer border border-mf-line bg-transparent" aria-label="Text colour" />
          </div>
          <button className="btn btn-solid" onClick={addText}>Add text</button>
          <div className="panel p-3">
            <div className="flex justify-between text-[11px] uppercase tracking-widest text-mf-muted"><span>Arc</span><span className="font-mono">{sel.arc}°</span></div>
            <input type="range" min={-180} max={180} step={2} value={sel.arc} disabled={!sel.isText}
              onChange={(e) => applyArc(Number(e.target.value))} onMouseUp={snapshot} onTouchEnd={snapshot}
              className="mt-2 w-full accent-mf-gold" />
            <p className="mt-1 text-xs text-mf-dim">{sel.isText ? "Bends the selected text along a circle. Double-click text to edit." : "Select a text object to bend it."}</p>
          </div>
        </div>
      )}

      {tab === "upload" && (
        <div className="grid gap-3">
          <label className="panel flex cursor-pointer flex-col items-center justify-center border-dashed p-6 text-center hover:border-mf-gold">
            <span className="font-display text-lg uppercase text-mf-gold">Drop art here</span>
            <span className="mt-1 text-xs text-mf-muted">PNG · JPG · SVG — or tap to browse</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = ""; }} />
          </label>
          <DpiReadout sel={sel} />
          <p className="text-xs text-mf-dim">We upscale to 300 DPI at save, but sharp art in = sharp print out. Vectors (SVG) are always clean.</p>
        </div>
      )}

      {tab === "tools" && (
        <div className="grid gap-3">
          <p className="text-xs text-mf-muted">Pocket Fixer, on the server. Select an image first.</p>
          <button className="btn" disabled={sel.kind !== "image" || busy !== null} onClick={() => imaging("bg-remove")}>{busy === "bg-remove" ? "Working…" : "Remove background"}</button>
          <button className="btn" disabled={sel.kind !== "image" || busy !== null} onClick={() => imaging("distress")}>{busy === "distress" ? "Working…" : "Distress"}</button>
          <DpiReadout sel={sel} />
          <p className="text-xs text-mf-dim">Blank photo: {photoSource === "ss" ? "S&S live" : "studio silhouette"}.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="mt-4 sm:grid sm:grid-cols-[300px_minmax(0,1fr)] sm:gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* Desktop rail */}
      <aside className="panel hidden sm:block">
        <div className="flex border-b border-mf-line">
          {tabs.map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 text-[11px] uppercase tracking-widest ${tab === t ? "bg-mf-gold text-mf-bg" : "text-mf-muted hover:text-mf-gold"}`}>{l}</button>
          ))}
        </div>
        {rail}
      </aside>

      {/* Stage */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-0">
          {(Object.keys(BLANKS) as BlankKey[]).map((k) => (
            <button key={k} className={chip(blank === k)} onClick={() => { setBlank(k); setLocation("front"); }}>{BLANKS[k].label}</button>
          ))}
          <span className="mx-1 h-5 w-px bg-mf-line" />
          {def.sides.map((l) => (
            <button key={l} className={chip(location === l)} onClick={() => setLocation(l)}>{LOCATION_LABELS[l]}</button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 px-4 sm:px-0">
          {COLORS.map((c, i) => (
            <button key={c.name} title={c.name} onClick={() => setColorIdx(i)}
              className={`h-7 w-7 rounded-full border-2 ${i === colorIdx ? "border-mf-gold" : "border-mf-line"}`} style={{ background: c.hex }} aria-label={c.name} />
          ))}
          <span className="ml-2 self-center text-[11px] uppercase tracking-widest text-mf-muted">{color.name} · {area.inW}×{area.inH} in</span>
        </div>

        <div ref={stageEl} onDrop={onDrop} onDragOver={(e) => e.preventDefault()} className="relative mt-3 w-full overflow-hidden bg-mf-panel sm:border sm:border-mf-line">
          <div ref={hostEl} />
          {status && <div className="pointer-events-none absolute left-3 top-3 border border-mf-gold bg-mf-bg/90 px-3 py-1.5 text-xs text-mf-cream">{status}</div>}
          {sel.dpi != null && (
            <div className={`absolute bottom-3 left-3 border px-2 py-1 font-mono text-[11px] ${sel.dpi < 300 ? "border-[color:var(--mf-warn)] text-[color:var(--mf-warn)]" : "border-mf-line text-mf-muted"} bg-mf-bg/90`}>
              {sel.dpi} DPI{sel.dpi < 300 ? " · under 300" : ""}
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 px-4 sm:px-0">
          <button className={tool} onClick={undo} disabled={hist.undo < 2} title="Undo (⌘Z)">Undo</button>
          <button className={tool} onClick={redo} disabled={hist.redo < 1} title="Redo (⇧⌘Z)">Redo</button>
          <span className="mx-1 h-5 w-px bg-mf-line" />
          <button className={tool} onClick={del} disabled={!sel.count}>Delete</button>
          <button className={tool} onClick={duplicate} disabled={!sel.count}>Duplicate</button>
          <button className={tool} onClick={forward} disabled={sel.count !== 1}>Forward</button>
          <button className={tool} onClick={backward} disabled={sel.count !== 1}>Back</button>
          <button className={`${tool} ${sel.locked ? "bg-mf-gold text-mf-bg" : ""}`} onClick={toggleLock} disabled={sel.count !== 1}>{sel.locked ? "Unlock" : "Lock"}</button>
          <span className="mx-1 h-5 w-px bg-mf-line" />
          <button className={`${tool} ${waterline ? "btn-blood" : ""}`} onClick={() => setWaterline((v) => !v)}>Waterline {waterline ? "on" : "off"}</button>
        </div>

        {/* Save + quote */}
        <div className="panel mt-4 p-4 sm:mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-solid" onClick={save} disabled={busy === "save"}>{busy === "save" ? "Cutting 300 DPI file…" : "Save design"}</button>
            <span className="text-xs text-mf-dim">
              {email ? <>Saving as <span className="text-mf-muted">{email}</span> · <button className="underline" onClick={() => setAskEmail(true)}>change</button></> : "We'll ask for your email once."}
            </span>
          </div>
          {askEmail && (
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get("email") ?? ""); if (v.includes("@")) { rememberEmail(v); setAskEmail(false); } }}>
              <input name="email" type="email" required defaultValue={email} className="input" placeholder="you@shop.com" autoFocus />
              <button className="btn" type="submit">Keep</button>
            </form>
          )}
          {saved && (
            <div className="mt-4 border-t border-mf-line pt-4">
              <p className="text-[11px] uppercase tracking-widest text-mf-muted">Print file</p>
              <p className="font-mono text-sm text-mf-cream">{saved.file_name ?? "saved"}</p>
              {saved.dpi_warning && <p className="mt-1 text-xs text-[color:var(--mf-warn)]">{saved.dpi_warning}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="label mb-0" htmlFor="qty">Qty</label>
                <input id="qty" type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="input w-24" />
                <button className="btn btn-blood" onClick={instantQuote} disabled={!saved.design_id || busy === "quote"}>{busy === "quote" ? "Pricing…" : "Make it real"}</button>
              </div>
              {quote && (
                <div className="mt-3 flex flex-wrap items-end gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-mf-muted">Instant quote · {qty} × {def.label.split(" · ")[1]} {color.name} · DTF {LOCATION_LABELS[location].toLowerCase()}</p>
                    <p className="font-display text-3xl text-mf-gold">{quote.total != null ? `$${quote.total.toFixed(2)}` : "Quote ready"}{quote.unit != null && <span className="ml-2 text-base text-mf-muted">(${quote.unit.toFixed(2)} ea)</span>}</p>
                  </div>
                  <button className="btn" onClick={sendQuote} disabled={busy === "send" || quoteSent}>{quoteSent ? "Sent to " + email : busy === "send" ? "Sending…" : "Send me this quote"}</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom sheet */}
      <div className="fixed inset-x-0 bottom-0 z-40 sm:hidden">
        {sheetOpen && (
          <div className="max-h-[55vh] overflow-y-auto border-t border-mf-line bg-mf-panel">
            <div className="flex justify-end px-3 pt-2"><button className="text-xs uppercase tracking-widest text-mf-muted" onClick={() => setSheetOpen(false)}>Close</button></div>
            {rail}
          </div>
        )}
        <div className="flex border-t border-mf-line bg-mf-bg">
          {tabs.map(([t, l]) => (
            <button key={t} onClick={() => { setTab(t); setSheetOpen(tab !== t || !sheetOpen); }}
              className={`flex-1 py-3 text-[11px] uppercase tracking-widest ${tab === t && sheetOpen ? "bg-mf-gold text-mf-bg" : "text-mf-muted"}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="h-14 sm:hidden" />
    </div>
  );
}

function DpiReadout({ sel }: { sel: SelInfo }) {
  if (sel.kind === "svg") return <p className="text-xs text-mf-gold">Vector — prints clean at any size.</p>;
  if (sel.dpi == null) return <p className="text-xs text-mf-dim">Select an image to see its DPI at the current size.</p>;
  return (
    <p className={`font-mono text-sm ${sel.dpi < 300 ? "text-[color:var(--mf-warn)]" : "text-mf-gold"}`}>
      {sel.dpi} DPI {sel.dpi < 300 ? "— under 300. Shrink it or upload bigger art." : "— print ready."}
    </p>
  );
}
