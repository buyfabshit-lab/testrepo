import type { Cluster, ClusterMode, Link, Thought } from "./types";
import { documentFrequency, similarity, tokenize, vectorize } from "./text";
import type { Vector } from "./text";

/** Everything the canvas needs, derived from the thoughts in one pass. */
export type Graph = {
  vectors: Map<string, Vector>;
  /** thought id -> the hue of the cluster it belongs to */
  hueOf: Map<string, number>;
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

/**
 * Tags the ingester puts on bubbles to say what *kind of artifact* they are.
 * They are the most common tags in a repo-built brain, so left in they win
 * every primary-tag contest and topic mode degenerates into "docs, modules,
 * history" — which is what `kind` already tells you. Still searchable; just
 * never a cluster name.
 */
const STRUCTURAL = new Set(["repo", "docs", "module", "schema", "todo", "history"]);

export function buildGraph(thoughts: Thought[], mode: ClusterMode = "topic"): Graph {
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

  const { clusters, clusterOf } = clusterize(thoughts, neighbours, mode);
  const hueOf = new Map<string, number>();
  for (const cluster of clusters) {
    for (const id of cluster.memberIds) hueOf.set(id, cluster.hue);
  }
  return { vectors, links, clusters, clusterOf, neighbours, hueOf };
}

/**
 * Group the bubbles. In "repo" mode a bubble sits with the repository it was
 * ingested from; in "topic" mode it sits with its primary tag — whichever of
 * its tags the rest of the brain uses most, so "mortgage" wins over
 * "flat-roof" and groups come out named after topics you think in.
 *
 * The obvious alternative — union-find over the strong links — chains: one
 * note tagged both "writing" and "second-brain" silently welds two topics into
 * one blob, and the more you write the fewer clusters you get.
 */
function clusterize(
  thoughts: Thought[],
  neighbours: Map<string, Link[]>,
  mode: ClusterMode,
) {
  const counts = new Map<string, number>();
  for (const thought of thoughts) {
    for (const tag of new Set(thought.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  const primary = new Map<string, string>();
  for (const thought of thoughts) {
    // A repo bubble's own repo tag is on every one of its siblings, so in topic
    // mode it would win every time and topic mode would just be repo mode.
    const own = repoName(thought.repo);
    const candidates = [...new Set(thought.tags)].filter(
      (tag) => tag !== own && !STRUCTURAL.has(tag),
    );
    if (candidates.length === 0) continue;
    primary.set(
      thought.id,
      candidates.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b))[0],
    );
  }

  // A thought with no usable tag joins whichever tagged neighbour it sits closest to.
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

  const keyOf = (thought: Thought) =>
    (mode === "repo" ? repoName(thought.repo) : undefined) ??
    primary.get(thought.id) ??
    "loose ends";

  const groups = new Map<string, string[]>();
  for (const thought of thoughts) {
    const key = keyOf(thought);
    const group = groups.get(key);
    if (group) group.push(thought.id);
    else groups.set(key, [thought.id]);
  }

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
      hue: hueFor(index),
    });
  });
  return { clusters, clusterOf };
}

/** "buyfabshit-lab/skrewu" -> "skrewu". */
function repoName(repo: string | undefined): string | undefined {
  return repo ? repo.split("/").pop()?.toLowerCase() : undefined;
}

/**
 * Colour is per cluster, not per kind. In a brain built from repositories
 * almost every bubble is a note or a fact, so colouring by kind paints the
 * whole canvas one shade and you cannot tell one repo from the next at a
 * glance — which is the single thing the canvas is for.
 *
 * The golden angle keeps adjacent clusters far apart on the wheel.
 */
function hueFor(index: number): number {
  return (200 + index * 137.508) % 360;
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
