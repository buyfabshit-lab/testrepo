import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import type { Thought } from "../lib/types";
import type { Graph } from "../lib/graph";
import type { Layout } from "../hooks/useLayout";

export type Camera = { x: number; y: number; scale: number };

type Props = {
  thoughts: Thought[];
  graph: Graph;
  layout: Layout;
  camera: Camera;
  onCamera: (next: Camera) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Bubbles an answer cited, or a search matched — they glow and stay lit. */
  highlightIds: string[];
  /** Bubbles currently being labelled by Claude. */
  pendingIds: string[];
  /** Ids captured this session, so they can pop in on arrival. */
  arrivedIds: string[];
};

const MIN_SCALE = 0.18;
const MAX_SCALE = 3;

export default function BubbleCanvas({
  thoughts,
  graph,
  layout,
  camera,
  onCamera,
  selectedId,
  onSelect,
  highlightIds,
  pendingIds,
  arrivedIds,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const gesture = useRef<
    | { type: "pan"; startX: number; startY: number; camX: number; camY: number }
    | { type: "drag"; id: string; moved: boolean }
    | null
  >(null);

  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.max(1, width), h: Math.max(1, height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /** Screen pixels -> world coordinates, the inverse of the group transform. */
  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - rect.width / 2) / camera.scale + camera.x,
        y: (clientY - rect.top - rect.height / 2) / camera.scale + camera.y,
      };
    },
    [camera],
  );

  const onWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    const factor = Math.exp(-event.deltaY * 0.0015);
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, camera.scale * factor));
    if (scale === camera.scale) return;
    // Keep the point under the cursor pinned while the scale changes.
    const anchor = toWorld(event.clientX, event.clientY);
    const ratio = 1 - camera.scale / scale;
    onCamera({ x: camera.x + (anchor.x - camera.x) * ratio, y: camera.y + (anchor.y - camera.y) * ratio, scale });
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const target = event.target as SVGElement;
    const id = target.closest("[data-bubble]")?.getAttribute("data-bubble") ?? null;
    (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
    if (id) {
      const world = toWorld(event.clientX, event.clientY);
      layout.grab(id, world.x, world.y);
      gesture.current = { type: "drag", id, moved: false };
    } else {
      gesture.current = {
        type: "pan",
        startX: event.clientX,
        startY: event.clientY,
        camX: camera.x,
        camY: camera.y,
      };
    }
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const active = gesture.current;
    if (!active) return;
    if (active.type === "pan") {
      onCamera({
        x: active.camX - (event.clientX - active.startX) / camera.scale,
        y: active.camY - (event.clientY - active.startY) / camera.scale,
        scale: camera.scale,
      });
      return;
    }
    const world = toWorld(event.clientX, event.clientY);
    layout.grab(active.id, world.x, world.y);
    active.moved = true;
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const active = gesture.current;
    gesture.current = null;
    layout.drop();
    (event.currentTarget as SVGSVGElement).releasePointerCapture(event.pointerId);
    if (!active) return;
    // A drag that never moved is a click: open the bubble.
    if (active.type === "drag" && !active.moved) onSelect(active.id);
    if (active.type === "pan") {
      const travelled = Math.hypot(event.clientX - active.startX, event.clientY - active.startY);
      if (travelled < 4) onSelect(null);
    }
  };

  const highlighted = new Set(highlightIds);
  const pending = new Set(pendingIds);
  const arrived = new Set(arrivedIds);
  const neighbourIds = new Set<string>();
  if (selectedId) {
    neighbourIds.add(selectedId);
    for (const link of graph.neighbours.get(selectedId) ?? []) {
      neighbourIds.add(link.a === selectedId ? link.b : link.a);
    }
  }

  /** In focus mode everything unrelated recedes rather than disappears. */
  const opacityFor = (id: string) => {
    if (highlighted.size && highlighted.has(id)) return 1;
    if (selectedId) return neighbourIds.has(id) ? 1 : 0.16;
    if (highlighted.size) return 0.2;
    return 1;
  };

  return (
    <svg
      ref={svgRef}
      className="canvas-surface absolute inset-0 h-full w-full"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <defs>
        <radialGradient id="vignette" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="#12121f" />
          <stop offset="100%" stopColor="#07070c" />
        </radialGradient>
        <filter id="glow" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="9" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="100%" height="100%" fill="url(#vignette)" />

      <g
        transform={`translate(${size.w / 2} ${size.h / 2}) scale(${camera.scale}) translate(${-camera.x} ${-camera.y})`}
      >
        {/* Cluster names sit above their bubbles, big and dim, like room labels. */}
        {clusterLabels(graph, layout).map((label) => (
          <text
            key={label.id}
            x={label.x}
            y={label.y}
            textAnchor="middle"
            fontSize={22}
            fontWeight={700}
            letterSpacing="0.18em"
            fill={`hsl(${label.hue} 65% 72%)`}
            opacity={0.34}
            style={{ textTransform: "uppercase", pointerEvents: "none" }}
          >
            {label.text}
          </text>
        ))}

        {graph.links.map((link) => {
          const a = layout.bodies.get(link.a);
          const b = layout.bodies.get(link.b);
          if (!a || !b) return null;
          const lit =
            !selectedId || (neighbourIds.has(link.a) && neighbourIds.has(link.b));
          return (
            <line
              key={`${link.a}-${link.b}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={lit ? "#6f6f9a" : "#3a3a52"}
              strokeWidth={0.5 + link.weight * 2.2}
              opacity={lit ? 0.16 + link.weight * 0.4 : 0.05}
            />
          );
        })}

        {thoughts.map((thought) => {
          const body = layout.bodies.get(thought.id);
          if (!body) return null;
          const hue = graph.hueOf.get(thought.id) ?? 210;
          const isSelected = thought.id === selectedId;
          const isLit = highlighted.has(thought.id);
          const opacity = opacityFor(thought.id);
          return (
            <g
              key={thought.id}
              data-bubble={thought.id}
              className={`bubble${arrived.has(thought.id) ? " arriving" : ""}`}
              transform={`translate(${body.x} ${body.y})`}
              opacity={opacity}
            >
              {pending.has(thought.id) && (
                <circle
                  className="thinking-ring"
                  r={body.r}
                  fill="none"
                  stroke={`hsl(${hue} 80% 70%)`}
                  strokeWidth={2}
                />
              )}
              {(isSelected || isLit) && (
                <circle
                  r={body.r + 6}
                  fill="none"
                  stroke={`hsl(${hue} 85% 72%)`}
                  strokeWidth={2}
                  filter="url(#glow)"
                  opacity={0.9}
                />
              )}
              <circle
                r={body.r}
                fill={`hsl(${hue} ${isLit || isSelected ? 55 : 42}% ${isLit || isSelected ? 26 : 17}%)`}
                stroke={`hsl(${hue} 70% ${isSelected ? 76 : 58}%)`}
                strokeWidth={isSelected ? 2 : 1.2}
              />
              {thought.pinned && (
                <circle cx={0} cy={-body.r + 7} r={3} fill={`hsl(${hue} 90% 78%)`} />
              )}
              <BubbleLabel title={thought.title} r={body.r} hue={hue} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** Wrap the title to fit inside the circle. Big bubbles get more lines. */
function BubbleLabel({ title, r, hue }: { title: string; r: number; hue: number }) {
  const fontSize = Math.max(8, Math.min(13, r / 4.4));
  const perLine = Math.max(8, Math.floor((r * 1.75) / (fontSize * 0.54)));
  const maxLines = r > 52 ? 4 : r > 38 ? 3 : 2;

  const lines: string[] = [];
  let line = "";
  for (const word of title.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= perLine) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === 0) return null;

  // Anything that did not fit gets an ellipsis rather than a hard cut.
  const rendered = lines.slice(0, maxLines);
  const fitted = rendered.join(" ").length < title.length;
  if (fitted) {
    const last = rendered[rendered.length - 1];
    rendered[rendered.length - 1] =
      last.length > perLine - 1 ? `${last.slice(0, perLine - 1)}…` : `${last}…`;
  }

  const top = -((rendered.length - 1) * fontSize * 1.15) / 2;
  return (
    <text
      textAnchor="middle"
      fontSize={fontSize}
      fontWeight={600}
      fill={`hsl(${hue} 45% 92%)`}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      {rendered.map((text, index) => (
        <tspan key={index} x={0} y={top + index * fontSize * 1.15 + fontSize * 0.34}>
          {text}
        </tspan>
      ))}
    </text>
  );
}

type ClusterLabel = { id: number; text: string; x: number; y: number; hue: number };

/**
 * Park each cluster's name above its topmost bubble, then lift any label that
 * would land on top of one already placed. Two adjacent clusters otherwise
 * print their names over each other and both become unreadable.
 */
function clusterLabels(graph: Graph, layout: Layout): ClusterLabel[] {
  const placed: ClusterLabel[] = [];
  for (const cluster of graph.clusters) {
    if (cluster.memberIds.length < 2) continue;
    const members = cluster.memberIds
      .map((id) => layout.bodies.get(id))
      .filter((body): body is NonNullable<typeof body> => Boolean(body));
    if (members.length === 0) continue;

    const x = members.reduce((sum, body) => sum + body.x, 0) / members.length;
    let y = Math.min(...members.map((body) => body.y - body.r)) - 16;
    const width = cluster.label.length * 16;

    // Walk upward until this label clears everything already on the canvas.
    for (let guard = 0; guard < 12; guard++) {
      const clash = placed.find(
        (other) =>
          Math.abs(other.x - x) < (width + other.text.length * 16) / 2 &&
          Math.abs(other.y - y) < 26,
      );
      if (!clash) break;
      y = clash.y - 28;
    }
    placed.push({ id: cluster.id, text: cluster.label, x, y, hue: cluster.hue });
  }
  return placed;
}
