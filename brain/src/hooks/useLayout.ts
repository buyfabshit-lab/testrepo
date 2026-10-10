import { useCallback, useEffect, useRef, useState } from "react";
import type { Body, Thought } from "../lib/types";
import type { Graph } from "../lib/graph";

/**
 * A small force simulation, hand-rolled so the app carries no layout
 * dependency. Bubbles push each other apart, linked bubbles pull together, and
 * every bubble falls toward its cluster's gravity well. Like d3-force it runs
 * on a decaying alpha and then sleeps, so a settled canvas costs nothing.
 */

const REPULSION = 5200;
/** Beyond this, two bubbles simply do not push each other. Without a cutoff the
 *  force is O(n²) in both cost and magnitude, and a few hundred bubbles sum to
 *  velocities that overflow to Infinity and poison every position with NaN. */
const REPULSION_RANGE = 420;
/** Hard ceiling on per-axis speed. The last line of defence against blow-up. */
const MAX_SPEED = 40;
const SPRING = 0.02;
const CLUSTER_PULL = 0.022;
const CENTER_PULL = 0.0015;
const DAMPING = 0.86;
const ALPHA_DECAY = 0.985;
/** Below this the canvas is visually still; stop rendering frames. */
const SLEEP = 0.008;

export function radiusFor(thought: Thought): number {
  const weight = Math.log2(thought.text.length + 8);
  return Math.max(26, Math.min(74, 14 + weight * 6 + (thought.pinned ? 8 : 0)));
}

/** Keep a velocity finite and sane, whatever the force sum did. */
function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-MAX_SPEED, Math.min(MAX_SPEED, value));
}

/** Cluster wells laid out on a phyllotaxis spiral: even spacing, no overlap. */
function wellFor(index: number, spread: number): { x: number; y: number } {
  const angle = index * 2.399963229728653;
  const radius = spread * Math.sqrt(index);
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

export type Layout = {
  bodies: Map<string, Body>;
  wells: Map<number, { x: number; y: number }>;
  /** Nudge the simulation awake — after an edit, a drag, or a reheat button. */
  reheat: (alpha?: number) => void;
  /** Drag support: pin a body under the cursor, then release it. */
  grab: (id: string, x: number, y: number) => void;
  drop: () => void;
};

/** A cluster of 60 needs far more elbow room than a cluster of 3. */
function biggestCluster(graph: Graph): number {
  return graph.clusters.reduce((most, cluster) => Math.max(most, cluster.memberIds.length), 0);
}

export function useLayout(thoughts: Thought[], graph: Graph): Layout {
  const bodies = useRef(new Map<string, Body>()).current;
  const wells = useRef(new Map<number, { x: number; y: number }>()).current;
  const alpha = useRef(1);
  const dragging = useRef<string | null>(null);
  const [, setFrame] = useState(0);

  const reheat = useCallback((value = 0.9) => {
    alpha.current = Math.max(alpha.current, value);
    setFrame((n) => n + 1);
  }, []);

  const grab = useCallback(
    (id: string, x: number, y: number) => {
      dragging.current = id;
      const body = bodies.get(id);
      if (body) {
        body.x = x;
        body.y = y;
        body.vx = 0;
        body.vy = 0;
      }
      reheat(0.45);
    },
    [bodies, reheat],
  );

  const drop = useCallback(() => {
    dragging.current = null;
  }, []);

  // Sync bodies to the current thoughts: add newcomers near their cluster,
  // drop bodies whose thought is gone, and keep everyone else where they are.
  useEffect(() => {
    const spread = 260 + Math.sqrt(thoughts.length) * 38 + biggestCluster(graph) * 3;
    wells.clear();
    graph.clusters.forEach((cluster, index) => wells.set(cluster.id, wellFor(index, spread)));

    const live = new Set<string>();
    for (const thought of thoughts) {
      live.add(thought.id);
      const cluster = graph.clusterOf.get(thought.id) ?? 0;
      const existing = bodies.get(thought.id);
      if (existing) {
        existing.r = radiusFor(thought);
        existing.cluster = cluster;
        continue;
      }
      const well = wells.get(cluster) ?? { x: 0, y: 0 };
      // Scatter newcomers across a disc sized to the cluster. Landing them all
      // on one small ring stacks dozens of bubbles almost exactly on top of
      // each other, and the repulsion needed to separate that is explosive.
      const crowd = graph.clusters[cluster]?.memberIds.length ?? 1;
      const angle = Math.random() * Math.PI * 2;
      const distance = 40 + Math.sqrt(Math.random()) * Math.sqrt(crowd) * 34;
      bodies.set(thought.id, {
        id: thought.id,
        x: well.x + Math.cos(angle) * distance,
        y: well.y + Math.sin(angle) * distance,
        vx: 0,
        vy: 0,
        r: radiusFor(thought),
        cluster,
      });
    }
    for (const id of [...bodies.keys()]) if (!live.has(id)) bodies.delete(id);
    reheat();
  }, [thoughts, graph, bodies, wells, reheat]);

  // The frame loop. Runs only while the canvas still has energy to spend.
  useEffect(() => {
    let raf = 0;
    const step = () => {
      if (alpha.current <= SLEEP) return;
      const list = [...bodies.values()];

      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let distance = Math.hypot(dx, dy);
          if (distance > REPULSION_RANGE) continue;
          if (distance < 0.01) {
            // Perfectly stacked bodies have no direction to separate along.
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            distance = 0.01;
          }
          const minimum = a.r + b.r + 14;
          // Inverse-square below the touching distance, softened beyond it.
          const push =
            distance < minimum
              ? REPULSION / (distance * distance) + (minimum - distance) * 0.4
              : REPULSION / (distance * distance * 1.6);
          const fx = (dx / distance) * push;
          const fy = (dy / distance) * push;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      for (const link of graph.links) {
        const a = bodies.get(link.a);
        const b = bodies.get(link.b);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 0.01;
        // Strong links want to sit closer than weak ones.
        const rest = a.r + b.r + 60 - link.weight * 40;
        const force = (distance - rest) * SPRING * link.weight;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      for (const body of list) {
        const well = wells.get(body.cluster);
        if (well) {
          body.vx += (well.x - body.x) * CLUSTER_PULL;
          body.vy += (well.y - body.y) * CLUSTER_PULL;
        }
        body.vx -= body.x * CENTER_PULL;
        body.vy -= body.y * CENTER_PULL;

        if (body.id === dragging.current) {
          body.vx = 0;
          body.vy = 0;
          continue;
        }
        body.vx = clamp(body.vx * DAMPING);
        body.vy = clamp(body.vy * DAMPING);
        body.x += body.vx * alpha.current;
        body.y += body.vy * alpha.current;
      }

      alpha.current *= ALPHA_DECAY;
      setFrame((n) => n + 1);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  });

  return { bodies, wells, reheat, grab, drop };
}
