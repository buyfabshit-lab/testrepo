import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import type { Thought } from "../lib/types";
import type { Graph } from "../lib/graph";
import type { Layout } from "../hooks/useLayout";
import FieldCanvas from "./FieldCanvas";

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
  const hostRef = useRef<HTMLDivElement>(null);
  // Direction of the key light, as a unit-ish vector in screen space. The
  // pointer carries it, so moving the mouse sweeps the highlights across every
  // sphere at once — one distant source, the way a sun would behave.
  const [light, setLight] = useState({ x: -0.42, y: -0.58 });
  const lightFrame = useRef(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const gesture = useRef<
    | { type: "pan"; startX: number; startY: number; camX: number; camY: number }
    | { type: "drag"; id: string; moved: boolean }
    | null
  >(null);

  useEffect(() => {
    const element = hostRef.current;
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

  /** Quantised and rAF-gated: a light this smooth is not worth a re-render per pixel. */
  const moveLight = (clientX: number, clientY: number) => {
    if (lightFrame.current) return;
    lightFrame.current = requestAnimationFrame(() => {
      lightFrame.current = 0;
      const rect = hostRef.current?.getBoundingClientRect();
      if (!rect) return;
      const nx = Math.round((((clientX - rect.left) / rect.width) * 2 - 1) * 20) / 20;
      const ny = Math.round((((clientY - rect.top) / rect.height) * 2 - 1) * 20) / 20;
      setLight((current) => (current.x === nx && current.y === ny ? current : { x: nx, y: ny }));
    });
  };

  useEffect(() => () => cancelAnimationFrame(lightFrame.current), []);

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
    moveLight(event.clientX, event.clientY);
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

  // Painter's algorithm: lower bubbles are nearer, so they paint last and
  // overlap the ones above them. Without it the overlaps contradict the
  // lighting and the spheres flatten back into discs.
  const depthSorted = [...thoughts].sort((a, b) => {
    const ya = layout.bodies.get(a.id)?.y ?? 0;
    const yb = layout.bodies.get(b.id)?.y ?? 0;
    return ya - yb;
  });

  return (
    <div ref={hostRef} className="absolute inset-0 overflow-hidden bg-void">
      <FieldCanvas
        bodies={[...layout.bodies.values()]}
        hueOf={graph.hueOf}
        camera={camera}
        width={size.w}
        height={size.h}
      />
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
        <filter id="glow" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="9" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/*
          Three shared gradients turn a flat disc into a lit sphere, and they
          are shared on purpose: hue stays on the circle underneath, so one set
          of defs shades every bubble on the canvas whatever colour it is, and
          no bubble needs a filter of its own.
        */}
        <radialGradient
          id="sphere-shade"
          cx={`${50 + light.x * 24}%`}
          cy={`${50 + light.y * 24}%`}
          r="78%"
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.30" />
          <stop offset="36%" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="74%" stopColor="#000000" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.44" />
        </radialGradient>
        {/* Light bouncing back off the field on the far side, which is what
            stops the underside reading as a hole rather than a curve. */}
        <radialGradient
          id="sphere-bounce"
          cx={`${50 - light.x * 30}%`}
          cy={`${50 - light.y * 30}%`}
          r="48%"
        >
          <stop offset="0%" stopColor="#cfe4ff" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#cfe4ff" stopOpacity="0" />
        </radialGradient>
        {/* A chrome bevel: the rim runs hot where it faces the light and goes
            almost black on the far side. On a polished sphere this edge does
            more work than the body does. */}
        <linearGradient
          id="rim-chrome"
          x1={`${50 + light.x * 50}%`}
          y1={`${50 + light.y * 50}%`}
          x2={`${50 - light.x * 50}%`}
          y2={`${50 - light.y * 50}%`}
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
          <stop offset="34%" stopColor="#dbe8ff" stopOpacity="0.72" />
          <stop offset="68%" stopColor="#2b3350" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#05060d" stopOpacity="0.85" />
        </linearGradient>
        {/* The reflected horizon — the hard light/dark split a polished surface
            picks up from its surroundings. */}
        <linearGradient
          id="sphere-horizon"
          x1={`${50 + light.x * 50}%`}
          y1={`${50 + light.y * 50}%`}
          x2={`${50 - light.x * 50}%`}
          y2={`${50 - light.y * 50}%`}
        >
          <stop offset="0%" stopColor="#eaf3ff" stopOpacity="0.3" />
          <stop offset="38%" stopColor="#eaf3ff" stopOpacity="0.04" />
          <stop offset="47%" stopColor="#000713" stopOpacity="0.1" />
          <stop offset="48%" stopColor="#9fc4ff" stopOpacity="0.2" />
          <stop offset="56%" stopColor="#000713" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#000713" stopOpacity="0.34" />
        </linearGradient>
        <radialGradient id="sphere-specular" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="38%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        {/* A gradient rather than a blur filter: same soft edge, a fraction of
            the cost once there are a couple of hundred of them. */}
        <radialGradient id="sphere-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.5" />
          <stop offset="62%" stopColor="#000000" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>

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
              stroke={lit ? "#8e9ad6" : "#39405c"}
              strokeWidth={0.4 + link.weight * 1.3}
              opacity={lit ? 0.07 + link.weight * 0.17 : 0.03}
            />
          );
        })}

        {depthSorted.map((thought) => {
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
              {/* Cast shadow, thrown away from the light and biased downward
                  so a bubble still reads as sitting in the field, not floating
                  free of it. */}
              <circle
                cx={-light.x * body.r * 0.26}
                cy={-light.y * body.r * 0.26 + body.r * 0.18}
                r={body.r * 1.14}
                fill="url(#sphere-shadow)"
                opacity={0.5}
              />
              {/* Glass, not paint: the body colour is translucent, so the
                  lattice behind carries straight through the sphere and the
                  field stays the thing everything is sitting in. */}
              <circle
                r={body.r}
                fill={`hsl(${hue} ${isLit || isSelected ? 80 : 68}% ${isLit || isSelected ? 54 : 46}%)`}
                fillOpacity={isLit || isSelected ? 0.44 : 0.3}
              />
              <circle r={body.r} fill="url(#sphere-shade)" />
              <circle r={body.r} fill="url(#sphere-horizon)" />
              <circle r={body.r} fill="url(#sphere-bounce)" />
              {/* Specular: small and hard, sitting on the side facing the light. */}
              <ellipse
                cx={light.x * body.r * 0.46}
                cy={light.y * body.r * 0.46}
                rx={body.r * 0.2}
                ry={body.r * 0.15}
                fill="url(#sphere-specular)"
                transform={`rotate(${(Math.atan2(light.y, light.x) * 180) / Math.PI})`}
                opacity={0.9}
              />
              {/* Two rings make the edge read as thickness rather than outline:
                  a dark inner wall, then the polished bevel over it. */}
              <circle
                r={body.r - 2.2}
                fill="none"
                stroke="#05060d"
                strokeWidth={1.6}
                opacity={0.45}
              />
              <circle
                r={body.r - 0.8}
                fill="none"
                stroke="url(#rim-chrome)"
                strokeWidth={isSelected ? 3 : 2}
                opacity={isSelected || isLit ? 1 : 0.8}
              />
              {/* A hue-tinted ring keeps each constellation identifiable once
                  the chrome has drained the colour out of the edge. */}
              <circle
                r={body.r}
                fill="none"
                stroke={`hsl(${hue} 90% ${isSelected ? 82 : 68}%)`}
                strokeWidth={isSelected ? 1.6 : 1}
                opacity={isSelected || isLit ? 0.95 : 0.5}
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
    </div>
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
      fill={`hsl(${hue} 40% 95%)`}
      // Drawn under the fill, this keeps a label readable wherever it lands —
      // over its own glass, over the field, or over the bubble behind it.
      stroke="#05050a"
      strokeWidth={2.4}
      strokeOpacity={0.6}
      strokeLinejoin="round"
      paintOrder="stroke"
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
