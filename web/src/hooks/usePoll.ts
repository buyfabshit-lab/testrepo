import { useCallback, useEffect, useState } from "react";
import { isConfigured, supabase } from "../lib/supabase";
import type { Poll, PollResult } from "../lib/types";
import type { Fan } from "../lib/fan";

/**
 * The current open poll and its live tally. Votes are counted by a
 * `security_invoker` view so the bars move for everyone the moment anyone
 * votes; one vote per fan is enforced by the table's primary key.
 */
export function usePoll(fan: Fan) {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [results, setResults] = useState<PollResult[]>([]);
  const [myOption, setMyOption] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshResults = useCallback(async (pollId: string) => {
    const { data } = await supabase
      .from("dime_poll_results")
      .select("*")
      .eq("poll_id", pollId)
      .order("position", { ascending: true });
    if (data) setResults(data);
  }, []);

  useEffect(() => {
    if (!isConfigured) return;
    let alive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const { data: polls } = await supabase
        .from("dime_polls")
        .select("*")
        .eq("is_open", true)
        .order("created_at", { ascending: false })
        .limit(1);

      const current = polls?.[0] ?? null;
      if (!alive || !current) return;
      setPoll(current);
      await refreshResults(current.id);

      const { data: mine } = await supabase
        .from("dime_poll_votes")
        .select("option_id")
        .eq("poll_id", current.id)
        .eq("fan_id", fan.id)
        .maybeSingle();
      if (alive && mine) setMyOption(mine.option_id);

      channel = supabase
        .channel("dime:poll")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "dime_poll_votes" },
          (payload) => {
            const row = payload.new as { poll_id: string; option_id: string };
            if (row.poll_id !== current.id) return;
            setResults((prev) =>
              prev.map((r) =>
                r.option_id === row.option_id ? { ...r, votes: r.votes + 1 } : r,
              ),
            );
          },
        )
        .subscribe();
    })();

    return () => {
      alive = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [fan.id, refreshResults]);

  const vote = useCallback(
    async (optionId: string) => {
      if (!poll || myOption) return;
      setError(null);
      setMyOption(optionId); // optimistic; the realtime echo supplies the count
      const { error: err } = await supabase
        .from("dime_poll_votes")
        .insert({ poll_id: poll.id, option_id: optionId, fan_id: fan.id });
      if (err) {
        setMyOption(null);
        setError("vote didn't land");
        await refreshResults(poll.id);
      }
    },
    [fan.id, myOption, poll, refreshResults],
  );

  const total = results.reduce((sum, r) => sum + r.votes, 0);
  return { poll, results, total, myOption, vote, error };
}
