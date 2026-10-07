"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/components/ui/api";
import { Button } from "@/components/ui/Button";

type Msg = { role: "user" | "assistant"; content: string; tools?: string[] };

/** Outlaw, the dispatcher. Drawer talks to POST /api/outlaw/chat with the running history. */
export function OutlawChat({ staffName }: { staffName: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs, open]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    const history = msgs.map(({ role, content }) => ({ role, content }));
    setMsgs((m) => [...m, { role: "user", content: message }]);
    setInput("");
    setBusy(true);
    try {
      const res = await api<{ text: string; tools_used?: string[] }>("/api/outlaw/chat", { body: { message, history } });
      setMsgs((m) => [...m, { role: "assistant", content: res.text, tools: res.tools_used }]);
    } catch (err) {
      setMsgs((m) => [...m, { role: "assistant", content: `Radio static: ${err instanceof Error ? err.message : "request failed"}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Talk to Outlaw"
        className="fixed bottom-[4.5rem] right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-mf-gold bg-mf-panel font-display text-xl text-mf-gold shadow-lg md:bottom-6">
        {open ? "×" : "O"}
      </button>
      {open ? (
        <aside className="fixed inset-x-0 bottom-0 z-40 flex h-[70vh] flex-col border-t border-mf-gold bg-mf-panel md:inset-x-auto md:bottom-20 md:right-4 md:h-[520px] md:w-[380px] md:border">
          <header className="flex items-center justify-between border-b border-mf-line px-4 py-2">
            <div>
              <p className="font-display text-lg uppercase tracking-widest text-mf-gold">Outlaw</p>
              <p className="text-[.6rem] uppercase tracking-widest text-mf-dim">dispatcher · talking to {staffName}</p>
            </div>
            <button type="button" className="text-mf-muted" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </header>
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
            {msgs.length === 0 ? <p className="text-mf-dim">Ask about an order, a customer, what is due, who has not paid. Outlaw only answers from the log.</p> : null}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-8 text-right" : "mr-8"}>
                <div className={`inline-block whitespace-pre-wrap px-3 py-2 text-left ${m.role === "user" ? "bg-mf-gold text-mf-bg" : "border border-mf-line bg-mf-bg text-mf-cream"}`}>{m.content}</div>
                {m.tools?.length ? <p className="mt-1 text-[.6rem] uppercase tracking-widest text-mf-dim">{m.tools.join(" · ")}</p> : null}
              </div>
            ))}
            {busy ? <p className="text-xs text-mf-dim">Outlaw is checking the log…</p> : null}
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-mf-line p-3">
            <input className="input" placeholder="What's due today?" value={input} onChange={(e) => setInput(e.target.value)} disabled={busy} />
            <Button type="submit" variant="solid" loading={busy}>Send</Button>
          </form>
        </aside>
      ) : null}
    </>
  );
}
