import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Brain, Thought } from "../lib/types";
import {
  DEFAULT_SETTINGS,
  hashtags,
  importBrain,
  loadBrain,
  loadSettings,
  makeThought,
  saveBrain,
  saveSettings,
} from "../lib/store";
import type { Settings } from "../lib/store";
import { buildGraph } from "../lib/graph";
import { describeError, enrich } from "../lib/claude";
import { SEED } from "../lib/seed";

export function useBrain() {
  const [thoughts, setThoughts] = useState<Thought[]>(() => loadBrain()?.thoughts ?? SEED());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [pending, setPending] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  /** Ids already handed to Claude, so a re-render never re-labels a thought. */
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const brain: Brain = { version: 1, thoughts };
    saveBrain(brain);
  }, [thoughts]);

  useEffect(() => saveSettings(settings), [settings]);

  const graph = useMemo(() => buildGraph(thoughts), [thoughts]);

  const vocabulary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const thought of thoughts) {
      for (const tag of thought.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  }, [thoughts]);

  const patch = useCallback((id: string, changes: Partial<Thought>) => {
    setThoughts((current) =>
      current.map((thought) =>
        thought.id === id ? { ...thought, ...changes, updatedAt: Date.now() } : thought,
      ),
    );
  }, []);

  /** Hand one thought to Claude for a title, tags and a kind. */
  const label = useCallback(
    async (thought: Thought) => {
      if (!settings.apiKey || !settings.autoEnrich) return;
      if (seen.current.has(thought.id)) return;
      seen.current.add(thought.id);
      setPending((ids) => [...ids, thought.id]);
      try {
        const result = await enrich(settings.apiKey, thought, vocabulary);
        patch(thought.id, {
          title: result.title,
          kind: result.kind as Thought["kind"],
          // Tags you typed yourself outrank the model's.
          tags: [...new Set([...hashtags(thought.text), ...result.tags])],
          summary: result.summary,
          enriched: true,
        });
      } catch (error) {
        setNotice(describeError(error));
        // Let a later retry through — this one may have failed on the network.
        seen.current.delete(thought.id);
      } finally {
        setPending((ids) => ids.filter((id) => id !== thought.id));
      }
    },
    [settings.apiKey, settings.autoEnrich, vocabulary, patch],
  );

  const capture = useCallback(
    (text: string): Thought | null => {
      const trimmed = text.trim();
      if (!trimmed) return null;
      const thought = makeThought(trimmed);
      setThoughts((current) => [...current, thought]);
      void label(thought);
      return thought;
    },
    [label],
  );

  const remove = useCallback((id: string) => {
    setThoughts((current) => current.filter((thought) => thought.id !== id));
  }, []);

  const relabel = useCallback(
    (id: string) => {
      const thought = thoughts.find((item) => item.id === id);
      if (!thought) return;
      seen.current.delete(id);
      void label(thought);
    },
    [thoughts, label],
  );

  const merge = useCallback((json: string) => {
    try {
      const incoming = importBrain(json);
      setThoughts((current) => {
        const byId = new Map(current.map((thought) => [thought.id, thought]));
        for (const thought of incoming) byId.set(thought.id, thought);
        return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
      });
      setNotice(`Imported ${incoming.length} thought${incoming.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That file could not be read.");
    }
  }, []);

  const wipe = useCallback(() => {
    setThoughts([]);
    seen.current.clear();
  }, []);

  const reseed = useCallback(() => {
    setThoughts(SEED());
    seen.current.clear();
  }, []);

  return {
    thoughts,
    graph,
    vocabulary,
    settings,
    setSettings: (next: Partial<Settings>) =>
      setSettings((current) => ({ ...DEFAULT_SETTINGS, ...current, ...next })),
    pending,
    notice,
    setNotice,
    capture,
    patch,
    remove,
    relabel,
    merge,
    wipe,
    reseed,
  };
}

export type BrainApi = ReturnType<typeof useBrain>;
