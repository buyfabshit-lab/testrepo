/** One captured thing. Every bubble on the canvas is exactly one of these. */
export type Thought = {
  id: string;
  /** Whatever you typed, verbatim. Never rewritten by the model. */
  text: string;
  /** Short label drawn on the bubble. Auto-titled, hand-editable. */
  title: string;
  /** Lowercase topic words. The tags are what pull bubbles into clusters. */
  tags: string[];
  kind: Kind;
  /** One line the model wrote about it, shown when a bubble is opened. */
  summary: string;
  /** Where it came from: a URL, a person, an app, or "" for a plain thought. */
  source: string;
  /** Pinned bubbles keep a fixed size and never fade out in focus mode. */
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  /** True once Claude has titled/tagged it. False means local heuristics did. */
  enriched: boolean;
};

export type Kind = "note" | "idea" | "task" | "person" | "link" | "fact";

export const KINDS: Kind[] = ["note", "idea", "task", "person", "link", "fact"];

/** Hue per kind, so a glance at the canvas reads as a mix of stuff, not soup. */
export const KIND_HUE: Record<Kind, number> = {
  note: 210,
  idea: 45,
  task: 350,
  person: 285,
  link: 190,
  fact: 150,
};

/** A group of related thoughts, recomputed from scratch whenever data changes. */
export type Cluster = {
  id: number;
  label: string;
  memberIds: string[];
  /** Where the cluster's gravity well sits, in world coordinates. */
  cx: number;
  cy: number;
  hue: number;
};

/** An undirected "these two are about the same thing" edge, with a strength. */
export type Link = { a: string; b: string; weight: number };

export type Brain = {
  version: 1;
  thoughts: Thought[];
};

/** Live simulation state for one bubble. Not persisted — recomputed on load. */
export type Body = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  cluster: number;
};
