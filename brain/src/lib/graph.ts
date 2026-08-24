import type { Cluster, Link, Thought } from "./types";
import { KIND_HUE } from "./types";
import { documentFrequency, similarity, tokenize, vectorize } from "./text";
import type { Vector } from "./text";

/** Everything the canvas needs, derived from the thoughts in one pass. */
export type Graph = {
  vectors: Map<string, Vector>;
  links: Link[];
  clusters: Cluster[];
  /** thought id -> cluster id */
  clusterOf: Map<string, number>;
  /** thought id -> its strongest neighbours, strongest first */
  neighbours: Map<string, Link[]>;
};

/** Tags count triple: an explicit tag is a much stronger signal than prose. */
function docFor(thought: Thought): string[] {
  const body = tokenize(`${thought.title} ${thought.text} ${thought.summary}`);
  const tags = thought.tags.flatMap((tag) => {
    const words = tokenize(tag);
    return [...words, ...words, ...words];
  });
  return [...body, ...tags];
}

/** Links weaker than this are noise; drawing them turns the canvas into fur. */
const LINK_FLOOR = 0.12;
/** Keeping every edge is O(n²) to draw; each bubble keeps its best few. */
const MAX_DEGREE = 6;

export function buildGraph(thoughts: Thought[]): Graph {
  const docs = thoughts.map(docFor);
  const df = documentFrequency(docs);
  const vectors = new Map<string, Vector>();
  thoughts.forEach((thought, i) => {
    vectors.set(thought.id, vectorize(docs[i], df, thoughts.length));
  });

  // Score every pair once, keep the strong ones.
  const scored: Link[] = [];
  for (let i = 0; i < thoughts.length; i++) {
    for (let j = i + 1; j < thoughts.length; j++) {
      const a = thoughts[i];
      const b = thoughts[j];
      const shared = a.tags.filter((tag) => b.tags.includes(tag)).length;
      const cosine = similarity(vectors.get(a.id)!, vectors.get(b.id)!);
      // A shared tag is worth about as much as a solid prose overlap.
      const weight = Math.min(1, cosine + shared * 0.22);
      if (weight >= LINK_FLOOR) scored.push({ a: a.id, b: b.id, weight });
    }
  }
  scored.sort((x, y) => y.weight - x.weight);

  // Thin the edge list down to each bubble's best few, keeping it symmetric.
  const degree = new Map<string, number>();
  const links: Link[] = [];
  for (const link of scored) {
    const da = degree.get(link.a) ?? 0;
    const db = degree.get(link.b) ?? 0;
    if (da >= MAX_DEGREE || db >= MAX_DEGREE) continue;
    degree.set(link.a, da + 1);
    degree.set(link.b, db + 1);
    links.push(link);
  }

  const neighbours = new Map<string, Link[]>();
  for (const thought of thoughts) neighbours.set(thought.id, []);
  for (const link of links) {
    neighbours.get(link.a)!.push(link);
    neighbours.get(link.b)!.push(link);
  }
  for (const list of neighbours.values()) list.sort((x, y) => y.weight - x.weight);

  const { clusters, clusterOf } = clusterize(thoughts, neighbours);
  return { vectors, links, clusters, clusterOf, neighbours };
}

/**
 * Cluster by primary tag. A thought's primary tag is whichever of its tags the
 * rest of the brain uses most, so "mortgage" wins over "flat-roof" and the
 * groups come out named after topics you actually think in.
 *
 * The obvious alternative — union-find over the strong links — chains: one note
 * tagged both "writing" and "second-brain" silently welds two topics into one
 * blob, and the more you write the fewer clusters you get.
 */
function clusterize(
  thoughts: Thought[],
  neighbours: Map<string, Link[]>,
) {
  const counts = new Map<string, number>();
  for (const thought of thoughts) {
    for (const tag of new Set(thought.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  const primary = new Map<string, string>();
  for (const thought of thoughts) {
    if (thought.tags.length === 0) continue;
    const best = [...new Set(thought.tags)].sort(
      (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b),
    )[0];
    primary.set(thought.id, best);
  }

  // An untagged thought joins whichever tagged neighbour it sits closest to.
  for (const thought of thoughts) {
    if (primary.has(thought.id)) continue;
    for (const link of neighbours.get(thought.id) ?? []) {
      const otherId = link.a === thought.id ? link.b : link.a;
      const tag = primary.get(otherId);
      if (tag) {
        primary.set(thought.id, tag);
        break;
      }
    }
  }

  const groups = new Map<string, string[]>();
  for (const thought of thoughts) {
    const key = primary.get(thought.id) ?? "loose ends";
    const group = groups.get(key);
    if (group) group.push(thought.id);
    else groups.set(key, [thought.id]);
  }

  const byId = new Map(thoughts.map((t) => [t.id, t]));
  // Biggest first, so cluster 0 lands at the centre of the spiral of wells.
  const ordered = [...groups.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );

  const clusters: Cluster[] = [];
  const clusterOf = new Map<string, number>();
  ordered.forEach(([label, memberIds], index) => {
    memberIds.forEach((id) => clusterOf.set(id, index));
    clusters.push({
      id: index,
      label,
      memberIds,
      // Real coordinates are assigned by the layout; these are placeholders.
      cx: 0,
      cy: 0,
      hue: hueFor(memberIds.map((id) => byId.get(id)!), index),
    });
  });
  return { clusters, clusterOf };
}

/** A cluster takes the hue of its dominant kind, nudged so neighbours differ. */
function hueFor(members: Thought[], index: number): number {
  const counts = new Map<number, number>();
  for (const member of members) {
    const hue = KIND_HUE[member.kind];
    counts.set(hue, (counts.get(hue) ?? 0) + 1);
  }
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 210;
  return (dominant + index * 17) % 360;
}

/** Ranked local search: tf-idf against the query, plus a literal-substring boost. */
export function search(query: string, thoughts: Thought[], graph: Graph, limit = 8): Thought[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const df = documentFrequency(thoughts.map(docFor));
  const queryVec = vectorize(terms, df, thoughts.length || 1);
  const needle = query.trim().toLowerCase();

  return thoughts
    .map((thought) => {
      const vec = graph.vectors.get(thought.id);
      let score = vec ? similarity(queryVec, vec) : 0;
      if (needle.length > 2 && thought.text.toLowerCase().includes(needle)) score += 0.3;
      if (thought.tags.some((tag) => terms.includes(tag))) score += 0.2;
      return { thought, score };
    })
    .filter((hit) => hit.score > 0.02)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((hit) => hit.thought);
}
