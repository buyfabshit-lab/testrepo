import { useCallback, useEffect, useRef, useState } from "react";
import { isConfigured, supabase } from "../lib/supabase";
import type { Reaction } from "../lib/types";
import type { Fan } from "../lib/fan";

export const EMOJI = ["🔥", "💖", "😭", "💀", "✨", "🫡"] as const;

export type Burst = { key: string; emoji: string; x: number; mine: boolean };

/**
 * Reactions do double duty: each row is both the animation trigger (via the
 * realtime INSERT) and the persisted record that feeds the hype meter. One
 * mechanism, so the burst you see and the number that's remembered can never
 * disagree.
 */
export function useReactions(fan: Fan) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [recentCount, setRecentCount] = useState(0);
  const counter = useRef(0);

  const push = useCallback((emoji: string, mine: boolean) => {
    counter.current += 1;
    const burst: Burst = {
      key: `${Date.now()}-${counter.current}`,
      emoji,
      x: Math.random() * 76 + 12,
      mine,
    };
    setBursts((prev) => [...prev, burst].slice(-28));
    window.setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.key !== burst.key));
    }, 2600);
  }, []);

  useEffect(() => {
    if (!isConfigured) return;
    let alive = true;

    void (async () => {
      const since = new Date(Date.now() - 3600_000).toISOString();
      const { count } = await supabase
        .from("dime_reactions")
        .select("*", { count: "exact", head: true })
        .gte("created_at", since);
      if (alive && typeof count === "number") setRecentCount(count);
    })();

    const channel = supabase
      .channel("dime:reactions")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dime_reactions" },
        (payload) => {
          const row = payload.new as Reaction;
          setRecentCount((c) => c + 1);
          // Our own reaction was already animated on click; don't double it.
          if (row.fan_id !== fan.id) push(row.emoji, false);
        },
      )
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [fan.id, push]);

  const react = useCallback(
    async (emoji: string) => {
      push(emoji, true);
      if (!isConfigured) return;
      await supabase.from("dime_reactions").insert({ fan_id: fan.id, emoji });
    },
    [fan.id, push],
  );

  return { bursts, react, recentCount };
}
