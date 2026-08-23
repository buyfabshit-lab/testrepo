import { useEffect, useState } from "react";
import { isConfigured, supabase } from "../lib/supabase";
import type { Fan } from "../lib/fan";

/**
 * How many people are in the room right now, via Realtime presence.
 * Presence is ephemeral by design — it lives in the channel, never in a
 * table — so nobody's visit is recorded anywhere.
 */
export function usePresence(fan: Fan) {
  const [count, setCount] = useState(1);
  const [handles, setHandles] = useState<string[]>([]);

  useEffect(() => {
    if (!isConfigured) return;

    const channel = supabase.channel("dime:room", {
      config: { presence: { key: fan.id } },
    });

    const sync = () => {
      const state = channel.presenceState<{ handle: string; hue: number }>();
      const keys = Object.keys(state);
      setCount(Math.max(1, keys.length));
      setHandles(
        keys
          .map((k) => state[k]?.[0]?.handle)
          .filter((h): h is string => Boolean(h))
          .slice(0, 24),
      );
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ handle: fan.handle, hue: fan.hue });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fan.id, fan.handle, fan.hue]);

  return { count, handles };
}
