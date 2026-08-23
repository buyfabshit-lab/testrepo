import { useEffect, useState } from "react";
import { isConfigured, supabase } from "../lib/supabase";
import type { Settings } from "../lib/types";

const FALLBACK: Settings = {
  id: 1,
  display_name: "DIME",
  tagline: "late nights, loud games, louder chat",
  bio: null,
  avatar_url: "/dime.jpg",
  location: "New York",
  timezone: "America/New_York",
  is_live: false,
  stream_title: null,
  stream_platform: null,
  stream_embed_url: null,
  stream_url: null,
  next_stream_at: null,
  socials: [],
  updated_at: new Date().toISOString(),
};

/**
 * The single settings row, kept live. When DIME flips `is_live` in the
 * dashboard every open tab switches over without a refresh.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(FALLBACK);
  const [loading, setLoading] = useState(isConfigured);

  useEffect(() => {
    if (!isConfigured) return;
    let alive = true;

    void (async () => {
      const { data } = await supabase.from("dime_settings").select("*").eq("id", 1).maybeSingle();
      if (alive && data) setSettings({ ...FALLBACK, ...data });
      if (alive) setLoading(false);
    })();

    const channel = supabase
      .channel("dime:settings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dime_settings" },
        (payload) => {
          const next = payload.new as Settings | null;
          if (next && next.id === 1) setSettings((prev) => ({ ...prev, ...next }));
        },
      )
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  return { settings, loading };
}
