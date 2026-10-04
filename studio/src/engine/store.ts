import { useCallback, useMemo, useReducer } from "react";
import { blankById } from "./blanks";
import { colorById } from "./colors";
import { measureText } from "./text";
import { printPx, uid, type BlankId, type Design, type ImageLayer, type Layer, type TextLayer } from "./types";

export function newDesign(blank: BlankId = "tee-front", color = "black"): Design {
  return { id: crypto.randomUUID(), name: "Untitled drop", blank, color, layers: [], updatedAt: new Date().toISOString() };
}

export interface State {
  design: Design;
  selectedId: string | null;
  past: Design[];
  future: Design[];
  dirty: boolean;
  /** Design as it was when a drag started; pushed to history on commit. */
  snapshot: Design | null;
}

type Action =
  | { type: "replace"; design: Design; keepHistory?: boolean }
  | { type: "setBlank"; blank: BlankId }
  | { type: "setColor"; color: string }
  | { type: "rename"; name: string }
  | { type: "add"; layer: Layer }
  | { type: "update"; id: string; patch: Partial<Layer>; transient?: boolean }
  | { type: "remove"; id: string }
  | { type: "duplicate"; id: string }
  | { type: "reorder"; id: string; dir: "up" | "down" | "top" | "bottom" }
  | { type: "select"; id: string | null }
  | { type: "begin" }
  | { type: "commit" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "markSaved" };

const HISTORY = 60;

function push(state: State, design: Design): State {
  return { ...state, design: { ...design, updatedAt: new Date().toISOString() }, past: [...state.past.slice(-HISTORY), state.design], future: [], dirty: true };
}

function reducer(state: State, a: Action): State {
  const d = state.design;
  switch (a.type) {
    case "replace":
      return { design: a.design, selectedId: null, past: a.keepHistory ? state.past : [], future: [], dirty: false, snapshot: null };
    case "setBlank": {
      if (d.blank === a.blank) return state;
      // Keep layers but re-center them into the new print area so nothing is lost.
      const from = printPx(blankById(d.blank));
      const to = printPx(blankById(a.blank));
      const fit = Math.min(to.w / from.w, to.h / from.h);
      const layers = d.layers.map((l) => ({
        ...l,
        x: to.w / 2 + (l.x - from.w / 2) * fit,
        y: to.h / 2 + (l.y - from.h / 2) * fit,
        scale: l.scale * fit,
      }));
      return push(state, { ...d, blank: a.blank, layers });
    }
    case "setColor":
      return d.color === a.color ? state : push(state, { ...d, color: a.color });
    case "rename":
      return { ...state, design: { ...d, name: a.name }, dirty: true };
    case "add":
      return { ...push(state, { ...d, layers: [...d.layers, a.layer] }), selectedId: a.layer.id };
    case "update": {
      const layers = d.layers.map((l) => (l.id === a.id ? ({ ...l, ...a.patch } as Layer) : l));
      if (a.transient) return { ...state, design: { ...d, layers }, dirty: true };
      return push(state, { ...d, layers });
    }
    case "remove":
      return { ...push(state, { ...d, layers: d.layers.filter((l) => l.id !== a.id) }), selectedId: state.selectedId === a.id ? null : state.selectedId };
    case "duplicate": {
      const src = d.layers.find((l) => l.id === a.id);
      if (!src) return state;
      const copy = { ...src, id: uid(), name: `${src.name} copy`, x: src.x + 60, y: src.y + 60 } as Layer;
      const i = d.layers.indexOf(src);
      const layers = [...d.layers.slice(0, i + 1), copy, ...d.layers.slice(i + 1)];
      return { ...push(state, { ...d, layers }), selectedId: copy.id };
    }
    case "reorder": {
      const i = d.layers.findIndex((l) => l.id === a.id);
      if (i < 0) return state;
      const layers = [...d.layers];
      const [item] = layers.splice(i, 1);
      const j = a.dir === "up" ? Math.min(layers.length, i + 1) : a.dir === "down" ? Math.max(0, i - 1) : a.dir === "top" ? layers.length : 0;
      layers.splice(j, 0, item);
      return push(state, { ...d, layers });
    }
    case "select":
      return state.selectedId === a.id ? state : { ...state, selectedId: a.id };
    case "begin":
      return { ...state, snapshot: d };
    case "commit": {
      // Promote a finished drag into history as one undo step.
      const snap = state.snapshot;
      if (!snap || snap === d) return { ...state, snapshot: null };
      return { ...state, past: [...state.past.slice(-HISTORY), snap], future: [], snapshot: null };
    }
    case "undo": {
      const prev = state.past[state.past.length - 1];
      if (!prev) return state;
      return { ...state, design: prev, past: state.past.slice(0, -1), future: [d, ...state.future], dirty: true };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return { ...state, design: next, past: [...state.past, d], future: state.future.slice(1), dirty: true };
    }
    case "markSaved":
      return { ...state, dirty: false };
  }
}

export function useDesignStore(initial?: Design) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    design: initial ?? newDesign(),
    selectedId: null,
    past: [],
    future: [],
    dirty: false,
    snapshot: null,
  }));

  const addImage = useCallback(
    (src: string, w: number, h: number, name = "Artwork") => {
      const blank = blankById(state.design.blank);
      const area = printPx(blank);
      const scale = Math.min(1, (area.w * 0.8) / w, (area.h * 0.8) / h);
      const layer: ImageLayer = {
        id: uid(), kind: "image", name, src, naturalW: w, naturalH: h, scale,
        x: area.w / 2, y: area.h / 2, rotation: 0, opacity: 1, visible: true, locked: false,
      };
      dispatch({ type: "add", layer });
    },
    [state.design.blank],
  );

  const addText = useCallback(
    (text = "YOUR TEXT") => {
      const blank = blankById(state.design.blank);
      const area = printPx(blank);
      const dark = colorById(state.design.color).dark;
      const fontSize = Math.round(Math.min(area.w / 5, area.h / 3));
      const draft: TextLayer = {
        id: uid(), kind: "text", name: text, text, fontFamily: "Bebas Neue", fontWeight: 400, fontSize,
        color: dark ? "#ffffff" : "#0a0a0a", letterSpacing: 0.04, lineHeight: 1.05, align: "center",
        strokeWidth: 0, strokeColor: "#000000", uppercase: false,
        naturalW: 10, naturalH: 10, scale: 1, x: area.w / 2, y: area.h / 2, rotation: 0, opacity: 1, visible: true, locked: false,
      };
      const m = measureText(draft);
      dispatch({ type: "add", layer: { ...draft, naturalW: m.w, naturalH: m.h } });
    },
    [state.design.blank, state.design.color],
  );

  const updateLayer = useCallback((id: string, patch: Partial<Layer>, transient = false) => {
    dispatch({ type: "update", id, patch, transient });
  }, []);

  /** Text edits change intrinsic size; re-measure so handles stay accurate. */
  const updateText = useCallback(
    (id: string, patch: Partial<TextLayer>) => {
      const l = state.design.layers.find((x) => x.id === id);
      if (!l || l.kind !== "text") return;
      const next = { ...l, ...patch } as TextLayer;
      const m = measureText(next);
      dispatch({ type: "update", id, patch: { ...patch, naturalW: m.w, naturalH: m.h, name: patch.text !== undefined ? patch.text.split("\n")[0] || "Text" : l.name } as Partial<Layer> });
    },
    [state.design.layers],
  );

  const api = useMemo(
    () => ({
      dispatch,
      addImage,
      addText,
      updateLayer,
      updateText,
      select: (id: string | null) => dispatch({ type: "select", id }),
      remove: (id: string) => dispatch({ type: "remove", id }),
      duplicate: (id: string) => dispatch({ type: "duplicate", id }),
      reorder: (id: string, dir: "up" | "down" | "top" | "bottom") => dispatch({ type: "reorder", id, dir }),
      setBlank: (blank: BlankId) => dispatch({ type: "setBlank", blank }),
      setColor: (color: string) => dispatch({ type: "setColor", color }),
      rename: (name: string) => dispatch({ type: "rename", name }),
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),
      begin: () => dispatch({ type: "begin" }),
      commit: () => dispatch({ type: "commit" }),
      replace: (design: Design) => dispatch({ type: "replace", design }),
      markSaved: () => dispatch({ type: "markSaved" }),
    }),
    [addImage, addText, updateLayer, updateText],
  );

  return { state, ...api };
}

export type StoreApi = ReturnType<typeof useDesignStore>;
