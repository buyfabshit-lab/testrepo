import { useCallback, useEffect, useState } from "react";
import { isConfigured, supabase } from "../lib/supabase";
import type { WallPost } from "../lib/types";
import type { Fan } from "../lib/fan";

const HEARTED_KEY = "dime.hearted.v1";

function loadHearted(): Set<number> {
  try {
    const raw = localStorage.getItem(HEARTED_KEY);
    return new Set(raw ? (JSON.parse(raw) as number[]) : []);
  } catch {
    return new Set();
  }
}

/**
 * The fan wall — the persistent half of the room. Posts arrive live; the
 * heart count is maintained server-side by a trigger, so the count that
 * comes back over realtime is authoritative for every viewer.
 */
export function useWall(fan: Fan) {
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [hearted, setHearted] = useState<Set<number>>(() => loadHearted());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) return;
    let alive = true;

    void (async () => {
      const { data } = await supabase
        .from("dime_wall_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);
      if (alive && data) setPosts(data);
    })();

    const channel = supabase
      .channel("dime:wall")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dime_wall_posts" },
        (payload) => {
          const row = payload.new as WallPost;
          setPosts((prev) =>
            prev.some((p) => p.id === row.id) ? prev : [row, ...prev].slice(0, 40),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dime_wall_hearts" },
        (payload) => {
          const { post_id } = payload.new as { post_id: number };
          setPosts((prev) =>
            prev.map((p) => (p.id === post_id ? { ...p, hearts: p.hearts + 1 } : p)),
          );
        },
      )
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  const post = useCallback(
    async (body: string) => {
      const text = body.trim();
      if (!text || !isConfigured) return false;
      setError(null);
      const { error: err } = await supabase.from("dime_wall_posts").insert({
        fan_id: fan.id,
        handle: fan.handle,
        body: text.slice(0, 500),
        hue: fan.hue,
      });
      if (err) {
        setError(
          err.message.includes("Rate limit")
            ? "you've signed the wall a few times already — give it a minute"
            : "couldn't post that",
        );
        return false;
      }
      return true;
    },
    [fan],
  );

  const heart = useCallback(
    async (postId: number) => {
      if (hearted.has(postId) || !isConfigured) return;
      // Mark locally first: the realtime echo is what moves the count, and
      // the PK on (post_id, fan_id) makes a double-send a no-op anyway.
      const next = new Set(hearted).add(postId);
      setHearted(next);
      try {
        localStorage.setItem(HEARTED_KEY, JSON.stringify([...next]));
      } catch {
        /* non-fatal */
      }
      await supabase.from("dime_wall_hearts").insert({ post_id: postId, fan_id: fan.id });
    },
    [fan.id, hearted],
  );

  return { posts, post, heart, hearted, error };
}
