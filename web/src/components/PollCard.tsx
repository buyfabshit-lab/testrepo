import { motion } from "motion/react";
import type { PollResult, Poll } from "../lib/types";

export function PollCard({
  poll,
  results,
  total,
  myOption,
  onVote,
  error,
}: {
  poll: Poll | null;
  results: PollResult[];
  total: number;
  myOption: string | null;
  onVote: (optionId: string) => void;
  error: string | null;
}) {
  if (!poll) {
    return (
      <div className="rounded-3xl glass p-6">
        <h3 className="font-display text-sm font-bold tracking-wide text-bone">POLL</h3>
        <p className="mt-3 text-sm text-ash">
          No poll running. DIME opens one when there's a decision worth handing over.
        </p>
      </div>
    );
  }

  const voted = Boolean(myOption);
  const leader = results.reduce<PollResult | null>(
    (best, r) => (!best || r.votes > best.votes ? r : best),
    null,
  );

  return (
    <div className="rounded-3xl glass p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold tracking-wide text-bone">POLL</h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
          {total} {total === 1 ? "vote" : "votes"}
        </span>
      </div>

      <p className="mt-3 text-balance-pretty text-lg font-medium leading-snug text-bone">
        {poll.question}
      </p>

      <div className="mt-5 space-y-2.5">
        {results.map((r) => {
          const pct = total ? Math.round((r.votes / total) * 100) : 0;
          const mine = myOption === r.option_id;
          const winning = voted && leader?.option_id === r.option_id && total > 0;

          return (
            <button
              key={r.option_id}
              type="button"
              disabled={voted}
              onClick={() => onVote(r.option_id)}
              className={`relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left transition ${
                mine
                  ? "border-hot-500/60 bg-hot-500/10"
                  : "border-white/10 hover:border-white/25 hover:bg-white/5"
              } ${voted ? "cursor-default" : "cursor-pointer"}`}
            >
              {voted && (
                <motion.span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded-r-xl"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  style={{
                    background: winning
                      ? "linear-gradient(90deg, color-mix(in oklab, var(--color-hot-500) 40%, transparent), color-mix(in oklab, var(--color-gold-500) 25%, transparent))"
                      : "color-mix(in oklab, var(--color-bone) 8%, transparent)",
                  }}
                />
              )}
              <span className="relative flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-bone">
                  {r.label}
                  {mine && <span className="ml-2 text-xs text-hot-400">your pick</span>}
                </span>
                {voted && (
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-bone/90">
                    {pct}%
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-ash">
        {error
          ? error
          : voted
            ? "Locked in. Bars move as everyone else votes."
            : "One vote each. Pick carefully."}
      </p>
    </div>
  );
}
