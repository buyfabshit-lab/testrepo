import { useCallback, useEffect, useRef, useState } from "react";
import { isConfigured, supabase } from "../lib/supabase";
import type { ChatMessage } from "../lib/types";
import type { Fan } from "../lib/fan";

const WINDOW = 80;

/**
 * Live chat. Loads the tail of the log, then appends via realtime INSERT
 * events. Sends are optimistic-free on purpose: the row round-trips through
 * Postgres so what you see is exactly what everyone else sees, and a
 * rate-limit rejection surfaces as an error instead of a phantom message.
 */
export function useChat(fan: Fan) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const seen = useRef(new Set<number>());

  useEffect(() => {
    if (!isConfigured) return;
    let alive = true;

    void (async () => {
      const { data } = await supabase
        .from("dime_chat_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(WINDOW);
      if (!alive || !data) return;
      const ordered = [...data].reverse();
      ordered.forEach((m) => seen.current.add(m.id));
      setMessages(ordered);
    })();

    const channel = supabase
      .channel("dime:chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dime_chat_messages" },
        (payload) => {
          const row = payload.new as ChatMessage;
          if (seen.current.has(row.id)) return;
          seen.current.add(row.id);
          setMessages((prev) => [...prev, row].slice(-WINDOW));
        },
      )
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  const send = useCallback(
    async (body: string) => {
      const text = body.trim();
      if (!text || !isConfigured) return false;
      setSending(true);
      setError(null);
      const { error: err } = await supabase.from("dime_chat_messages").insert({
        fan_id: fan.id,
        handle: fan.handle,
        body: text.slice(0, 280),
        hue: fan.hue,
      });
      setSending(false);
      if (err) {
        setError(
          err.message.includes("Rate limit")
            ? "easy — you're going too fast"
            : "couldn't send that",
        );
        return false;
      }
      return true;
    },
    [fan],
  );

  return { messages, send, sending, error };
}
