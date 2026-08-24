/**
 * Local text understanding. Everything here runs in the browser with no API
 * key, which is what lets the canvas cluster, link and search itself even when
 * Claude is not configured. Claude improves the labels; it is never load-bearing.
 */

const STOP = new Set(
  `a about above after again against all am an and any are as at be because been
   before being below between both but by can cant cannot could did do does doing
   dont down during each few for from further had has have having he her here hers
   herself him himself his how i if in into is it its itself just me more most my
   myself no nor not of off on once only or other ought our ours ourselves out over
   own same she should so some such than that the their theirs them themselves then
   there these they this those through to too under until up very was we were what
   when where which while who whom why will with would you your yours yourself
   yourselves im ive id thing things really actually maybe like get got make made
   want need know think going go one two also lot bit new`
    .split(/\s+/)
    .filter(Boolean),
);

/** Words, lowercased, stop-words dropped, 2-char noise dropped. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9'+#.-]*/g) ?? [])
    .map((w) => w.replace(/^[.'-]+|[.'-]+$/g, ""))
    .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
}

export type Vector = Map<string, number>;

/** Document frequency across the corpus, used to damp common words. */
export function documentFrequency(docs: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const term of new Set(doc)) df.set(term, (df.get(term) ?? 0) + 1);
  }
  return df;
}

/** L2-normalised tf-idf vector, so cosine similarity is just a dot product. */
export function vectorize(doc: string[], df: Map<string, number>, total: number): Vector {
  const tf = new Map<string, number>();
  for (const term of doc) tf.set(term, (tf.get(term) ?? 0) + 1);

  const vec: Vector = new Map();
  let norm = 0;
  for (const [term, count] of tf) {
    const idf = Math.log((total + 1) / ((df.get(term) ?? 0) + 1)) + 1;
    const weight = (1 + Math.log(count)) * idf;
    vec.set(term, weight);
    norm += weight * weight;
  }
  norm = Math.sqrt(norm) || 1;
  for (const [term, weight] of vec) vec.set(term, weight / norm);
  return vec;
}

/** Cosine similarity of two normalised vectors, 0..1. Iterates the shorter one. */
export function similarity(a: Vector, b: Vector): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, weight] of small) {
    const other = large.get(term);
    if (other !== undefined) dot += weight * other;
  }
  return dot;
}

/** The n highest-weighted terms — used to name a cluster from its members. */
export function topTerms(vec: Vector, n: number): string[] {
  return [...vec.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, n)
    .map(([term]) => term);
}

/** Sum vectors into a centroid, renormalised. */
export function centroid(vecs: Vector[]): Vector {
  const sum: Vector = new Map();
  for (const vec of vecs) {
    for (const [term, weight] of vec) sum.set(term, (sum.get(term) ?? 0) + weight);
  }
  let norm = 0;
  for (const weight of sum.values()) norm += weight * weight;
  norm = Math.sqrt(norm) || 1;
  for (const [term, weight] of sum) sum.set(term, weight / norm);
  return sum;
}

/** First sentence, or the first ~80 characters — a title before Claude sees it. */
export function guessTitle(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  const url = trimmed.match(/^https?:\/\/([^/\s]+)(\/\S*)?/i);
  if (url) return url[1].replace(/^www\./, "");
  const sentence = trimmed.split(/(?<=[.!?])\s/)[0] ?? trimmed;
  if (sentence.length <= 80) return sentence;
  return sentence.slice(0, 77).trimEnd() + "…";
}

/** Cheap kind detection so a fresh bubble is never mis-coloured for long. */
export function guessKind(text: string): "note" | "idea" | "task" | "person" | "link" | "fact" {
  const t = text.trim().toLowerCase();
  if (/^https?:\/\//.test(t)) return "link";
  if (/^(todo|task|remind me|remember to)\b/.test(t) || /^[-*]?\s*\[ ?\]/.test(t)) return "task";
  if (/\b(i should|need to|must|deadline|due|by (mon|tue|wed|thu|fri|sat|sun))\b/.test(t)) return "task";
  if (/^(idea|what if|concept)\b/.test(t) || /\bwhat if\b/.test(t)) return "idea";
  if (/^@\w/.test(t) || /\b(met|introduced to|his email|her email|their email)\b/.test(t)) return "person";
  return "note";
}

/** Highlight-free snippet around the first query hit, for search results. */
export function snippet(text: string, query: string, len = 140): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= len) return flat;
  const terms = tokenize(query);
  const lower = flat.toLowerCase();
  let at = -1;
  for (const term of terms) {
    const i = lower.indexOf(term);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return flat.slice(0, len - 1).trimEnd() + "…";
  const start = Math.max(0, at - Math.floor(len / 3));
  return (start > 0 ? "…" : "") + flat.slice(start, start + len).trimEnd() + "…";
}
