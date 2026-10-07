"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { parseIntercom, timeAgo, type IntercomLine } from "./intercom";

const POLL_MS = 30_000;

/** Persistent ticker: GET /api/outlaw/intercom every 30s, scrolls the latest Outlaw lines. */
export default function IntercomTicker() {
  const [lines, setLines] = useState<IntercomLine[]>([]);
  const [state, setState] = useState<"idle" | "ok" | "off">("idle");

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const load = async () => {
      try {
        const res = await fetch("/api/outlaw/intercom?limit=20", { cache: "no-store", signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const parsed = parseIntercom(await res.json());
        if (!alive) return;
        setLines(parsed);
        setState("ok");
      } catch {
        if (alive) setState("off");
      }
    };
    void load();
    const t = setInterval(load, POLL_MS);
    return () => { alive = false; ctrl.abort(); clearInterval(t); };
  }, []);

  const text = lines.length
    ? lines.map((l) => `${l.msg}${l.ts ? ` (${timeAgo(l.ts)})` : ""}`)
    : [state === "off" ? "Intercom static. Outlaw's radio is off or the line isn't wired yet." : "Listening for Outlaw…"];
  const dur = Math.max(20, text.join("").length / 6);

  return (
    <div className="flex items-center gap-3 overflow-hidden border-b border-mf-line bg-mf-bg px-4 py-1.5 text-xs" role="status" aria-label="Outlaw intercom">
      <style>{`@keyframes world-ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .world-ticker:hover .world-ticker-track { animation-play-state: paused }
        @media (prefers-reduced-motion: reduce) { .world-ticker-track { animation: none !important } }`}</style>
      <Link href="/world/intercom" className="flex shrink-0 items-center gap-1.5 uppercase tracking-[.18em] text-mf-blood no-underline">
        <span className={`inline-block h-2 w-2 rounded-full ${state === "ok" ? "bg-mf-blood" : "bg-mf-dim"}`} aria-hidden />
        Intercom
      </Link>
      <div className="world-ticker min-w-0 flex-1 overflow-hidden whitespace-nowrap">
        <div className="world-ticker-track inline-block" style={{ animation: `world-ticker ${dur}s linear infinite` }}>
          {[0, 1].map((copy) => (
            <span key={copy} aria-hidden={copy === 1}>
              {text.map((t, i) => <span key={i} className="mr-10 text-mf-muted"><span className="mr-2 text-mf-gold">◆</span>{t}</span>)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
