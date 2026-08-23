import { useEffect, useRef, useState } from "react";
import { shortTime } from "../lib/format";
import type { ChatMessage } from "../lib/types";
import type { Fan } from "../lib/fan";

export function ChatPanel({
  messages,
  send,
  sending,
  error,
  fan,
  presence,
}: {
  messages: ChatMessage[];
  send: (body: string) => Promise<boolean>;
  sending: boolean;
  error: string | null;
  fan: Fan;
  presence: number;
}) {
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  // Follow the tail only while the reader is already at the bottom, so
  // scrolling back through history isn't yanked away by new messages.
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    const text = draft;
    setDraft("");
    const ok = await send(text);
    if (!ok) setDraft(text); // give the message back rather than losing it
  };

  return (
    <div className="flex h-[30rem] flex-col overflow-hidden rounded-3xl glass">
      <div className="flex items-center justify-between border-b border-white/8 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-hot-500" />
          <h3 className="font-display text-sm font-bold tracking-wide text-bone">
            LIVE CHAT
          </h3>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
          {presence} here
        </span>
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="thin-scroll flex-1 space-y-2.5 overflow-y-auto px-5 py-4"
      >
        {messages.length === 0 && (
          <p className="pt-16 text-center text-sm text-ash">
            Nothing yet. Be the reason there's something here.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="group flex items-baseline gap-2 text-sm leading-snug">
            <span
              className="shrink-0 font-semibold"
              style={{ color: `hsl(${m.hue} 88% 68%)` }}
            >
              {m.handle}
            </span>
            <span className="min-w-0 flex-1 break-words text-bone/90">{m.body}</span>
            <span className="shrink-0 font-mono text-[10px] text-ash opacity-0 transition-opacity group-hover:opacity-100">
              {shortTime(m.created_at)}
            </span>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="border-t border-white/8 p-3">
        {error && <p className="px-2 pb-2 text-xs text-hot-400">{error}</p>}
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white/5 px-4 py-2.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: `hsl(${fan.hue} 90% 62%)` }}
            />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={280}
              placeholder={`say something as ${fan.handle}`}
              aria-label="Chat message"
              className="min-w-0 flex-1 bg-transparent text-sm text-bone outline-none placeholder:text-ash/70"
            />
          </div>
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="shrink-0 rounded-full bg-hot-500 px-5 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-white/8 disabled:text-ash"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
