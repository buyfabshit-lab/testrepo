import { useCallback, useEffect, useRef, useState } from "react";
import BubbleCanvas from "./components/BubbleCanvas";
import type { Camera } from "./components/BubbleCanvas";
import CaptureBar from "./components/CaptureBar";
import DetailPanel from "./components/DetailPanel";
import AskPanel from "./components/AskPanel";
import SettingsSheet from "./components/SettingsSheet";
import { useBrain } from "./hooks/useBrain";
import { useLayout } from "./hooks/useLayout";

export default function App() {
  const brain = useBrain();
  const layout = useLayout(brain.thoughts, brain.graph);

  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 0.85 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const [arrivedIds, setArrivedIds] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const flight = useRef<number>(0);

  const selected = brain.thoughts.find((thought) => thought.id === selectedId) ?? null;

  /** Glide the camera to a bubble instead of teleporting — you keep your bearings. */
  const flyTo = useCallback(
    (id: string) => {
      const body = layout.bodies.get(id);
      if (!body) return;
      cancelAnimationFrame(flight.current);
      const start = { ...camera };
      const target = { x: body.x, y: body.y, scale: Math.max(camera.scale, 1.05) };
      const began = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - began) / 480);
        // easeOutCubic
        const e = 1 - Math.pow(1 - t, 3);
        setCamera({
          x: start.x + (target.x - start.x) * e,
          y: start.y + (target.y - start.y) * e,
          scale: start.scale + (target.scale - start.scale) * e,
        });
        if (t < 1) flight.current = requestAnimationFrame(step);
      };
      flight.current = requestAnimationFrame(step);
    },
    [camera, layout.bodies],
  );

  useEffect(() => () => cancelAnimationFrame(flight.current), []);

  /** Frame the whole brain. The bubbles settle wherever physics puts them, so
   *  the only honest starting camera is one measured from where they landed. */
  const fitView = useCallback(() => {
    const bodies = [...layout.bodies.values()];
    if (bodies.length === 0) {
      setCamera({ x: 0, y: 0, scale: 0.85 });
      return;
    }
    // One non-finite coordinate would otherwise turn the whole camera into NaN,
    // and an SVG group transformed by NaN paints nothing at all.
    const finite = bodies.filter((body) => Number.isFinite(body.x) && Number.isFinite(body.y));
    if (finite.length === 0) {
      setCamera({ x: 0, y: 0, scale: 0.85 });
      return;
    }
    const left = Math.min(...finite.map((body) => body.x - body.r));
    const right = Math.max(...finite.map((body) => body.x + body.r));
    const top = Math.min(...finite.map((body) => body.y - body.r));
    const bottom = Math.max(...finite.map((body) => body.y + body.r));
    // Leave room for the panels that float over the canvas edges.
    const width = Math.max(1, window.innerWidth - 420);
    const height = Math.max(1, window.innerHeight - 220);
    const scale = Math.min(1.15, Math.max(0.2, Math.min(width / (right - left + 120), height / (bottom - top + 120))));
    setCamera({ x: (left + right) / 2, y: (top + bottom) / 2, scale });
  }, [layout.bodies]);

  // One fit once the opening simulation has settled, then never again unasked.
  // The guard lives inside the timer, not around it: StrictMode runs this
  // effect twice, and a guard on the outside cancels the only timer it set.
  const framed = useRef(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (framed.current) return;
      framed.current = true;
      fitView();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [fitView]);

  const goTo = useCallback(
    (id: string) => {
      setSelectedId(id);
      flyTo(id);
    },
    [flyTo],
  );

  const capture = useCallback(
    (text: string) => {
      const thought = brain.capture(text);
      if (!thought) return;
      setArrivedIds((ids) => [...ids, thought.id]);
      // Let the pop-in animation finish, then stop re-triggering it on re-render.
      window.setTimeout(
        () => setArrivedIds((ids) => ids.filter((id) => id !== thought.id)),
        600,
      );
    },
    [brain],
  );

  // Dismiss a notice on its own so it never becomes permanent furniture.
  useEffect(() => {
    if (!brain.notice) return;
    const timer = window.setTimeout(() => brain.setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [brain]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (event.key === "Escape") {
        if (settingsOpen) setSettingsOpen(false);
        else if (typing) target?.blur();
        else {
          setSelectedId(null);
          setHighlightIds([]);
        }
        return;
      }
      if (typing) return;
      if (event.key === "/") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('input[aria-label="Ask your brain"]')?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

  const hasKey = Boolean(brain.settings.apiKey);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <BubbleCanvas
        thoughts={brain.thoughts}
        graph={brain.graph}
        layout={layout}
        camera={camera}
        onCamera={setCamera}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          if (id) flyTo(id);
        }}
        highlightIds={highlightIds}
        pendingIds={brain.pending}
        arrivedIds={arrivedIds}
      />

      {brain.thoughts.length === 0 && !brain.booting && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="max-w-xs text-center text-sm leading-relaxed text-mist">
            Empty in here. Drop a thought in below and it becomes a bubble; drop in a few more and
            they start finding each other.
          </p>
        </div>
      )}

      {/* Everything above the canvas is pointer-transparent except the panels. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col p-3 sm:p-4">
        <header className="pointer-events-none flex items-start justify-between gap-3">
          <div className="panel pointer-events-auto rounded-2xl px-4 py-2.5">
            <h1 className="text-sm font-semibold tracking-tight">Second Brain</h1>
            <p className="text-xs text-mist">
              {brain.thoughts.length} bubble{brain.thoughts.length === 1 ? "" : "s"} ·{" "}
              {brain.graph.clusters.filter((cluster) => cluster.memberIds.length > 1).length}{" "}
              {brain.settings.clusterMode === "repo" ? "repos" : "topics"}
              {!hasKey && " · local only"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedId(null);
                setHighlightIds([]);
                layout.reheat();
                fitView();
              }}
              className="panel pointer-events-auto rounded-xl px-3 py-2 text-xs text-mist transition hover:text-chalk"
            >
              Recentre
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="panel pointer-events-auto rounded-xl px-3 py-2 text-xs text-mist transition hover:text-chalk"
            >
              Settings
            </button>
          </div>
        </header>

        <div className="pointer-events-none mt-3 flex min-h-0 flex-1 gap-3">
          <div className="hidden w-80 shrink-0 flex-col justify-start sm:flex">
            <AskPanel
              thoughts={brain.thoughts}
              graph={brain.graph}
              apiKey={brain.settings.apiKey}
              onHighlight={setHighlightIds}
              onGoTo={goTo}
            />
          </div>

          <div className="flex-1" />

          {selected && (
            <div className="pointer-events-none w-full max-w-sm shrink-0">
              <DetailPanel
                thought={selected}
                graph={brain.graph}
                thoughts={brain.thoughts}
                pending={brain.pending.includes(selected.id)}
                hasKey={hasKey}
                onPatch={brain.patch}
                onRemove={(id) => {
                  brain.remove(id);
                  setSelectedId(null);
                }}
                onRelabel={brain.relabel}
                onGoTo={goTo}
                onClose={() => setSelectedId(null)}
              />
            </div>
          )}
        </div>

        <div className="mx-auto mt-3 w-full max-w-2xl">
          <CaptureBar onCapture={capture} busy={brain.pending.length > 0} />
        </div>
      </div>

      {brain.notice && (
        <div className="panel absolute bottom-24 left-1/2 -translate-x-1/2 rounded-xl px-4 py-2 text-sm">
          {brain.notice}
        </div>
      )}

      {settingsOpen && (
        <SettingsSheet
          settings={brain.settings}
          onSettings={brain.setSettings}
          thoughts={brain.thoughts}
          onImport={brain.merge}
          onWipe={brain.wipe}
          onReseed={brain.reseed}
          onRefreshRepos={() => void brain.refreshFromRepos()}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
