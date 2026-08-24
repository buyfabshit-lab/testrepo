import type { Brain, Thought } from "./types";
import { guessKind, guessTitle } from "./text";

const KEY = "second-brain.v1";
const SETTINGS_KEY = "second-brain.settings.v1";

export type Settings = {
  /** Your own Anthropic key. Stays in this browser; never sent anywhere but the API. */
  apiKey: string;
  /** Auto-title and auto-tag each new thought with Claude as it lands. */
  autoEnrich: boolean;
};

export const DEFAULT_SETTINGS: Settings = { apiKey: "", autoEnrich: true };

function newId(): string {
  return crypto.randomUUID();
}

export function loadBrain(): Brain | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Brain;
    if (!parsed || !Array.isArray(parsed.thoughts)) return null;
    return { version: 1, thoughts: parsed.thoughts.map(normalise) };
  } catch {
    // A corrupt blob should cost you the session, not the app.
    return null;
  }
}

export function saveBrain(brain: Brain): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(brain));
  } catch {
    // Quota exceeded, private mode, or storage disabled: keep running in memory.
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Same as above — a browser that refuses storage still gets a working app.
  }
}

/** Fill in anything an older or hand-edited record is missing. */
function normalise(raw: Partial<Thought>): Thought {
  const text = raw.text ?? "";
  const now = Date.now();
  return {
    id: raw.id ?? newId(),
    text,
    title: raw.title || guessTitle(text),
    tags: (raw.tags ?? []).map((tag) => tag.toLowerCase().trim()).filter(Boolean),
    kind: raw.kind ?? guessKind(text),
    summary: raw.summary ?? "",
    source: raw.source ?? "",
    pinned: raw.pinned ?? false,
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? raw.createdAt ?? now,
    enriched: raw.enriched ?? false,
  };
}

/** Build a thought from raw captured text using local heuristics only. */
export function makeThought(text: string): Thought {
  const now = Date.now();
  const url = text.trim().match(/https?:\/\/\S+/);
  return {
    id: newId(),
    text: text.trim(),
    title: guessTitle(text),
    tags: hashtags(text),
    kind: guessKind(text),
    summary: "",
    source: url ? url[0] : "",
    pinned: false,
    createdAt: now,
    updatedAt: now,
    enriched: false,
  };
}

/** #tags you typed yourself always survive enrichment. */
export function hashtags(text: string): string[] {
  return [...(text.match(/#[a-z0-9][a-z0-9-]*/gi) ?? [])].map((tag) => tag.slice(1).toLowerCase());
}

export function exportBrain(brain: Brain): string {
  return JSON.stringify(brain, null, 2);
}

/**
 * Accepts either an export from this app or a bare array of thoughts, and
 * returns thoughts ready to merge. Throws on anything else so the caller can
 * tell you the file was wrong instead of silently wiping the canvas.
 */
export function importBrain(json: string): Thought[] {
  const parsed: unknown = JSON.parse(json);
  const list = Array.isArray(parsed)
    ? parsed
    : ((parsed as Brain | null)?.thoughts ?? null);
  if (!Array.isArray(list)) throw new Error("No thoughts found in that file.");
  return list.map((item) => normalise(item as Partial<Thought>));
}
