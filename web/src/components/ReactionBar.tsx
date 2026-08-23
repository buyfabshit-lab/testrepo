import { AnimatePresence, motion } from "motion/react";
import { EMOJI, type Burst } from "../hooks/useReactions";

/** Fixed-position emoji that float up from the reaction bar, for everyone. */
export function ReactionLayer({ bursts }: { bursts: Burst[] }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <AnimatePresence>
        {bursts.map((b) => (
          <motion.span
            key={b.key}
            initial={{ opacity: 0, y: 0, scale: 0.4 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: -260 - Math.random() * 120,
              scale: [0.4, 1.15, 1, 0.9],
              x: (Math.random() - 0.5) * 90,
              rotate: (Math.random() - 0.5) * 50,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.4, ease: "easeOut" }}
            className="absolute bottom-24 text-3xl"
            style={{
              left: `${b.x}%`,
              filter: b.mine ? "drop-shadow(0 0 10px var(--color-hot-500))" : undefined,
            }}
          >
            {b.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function ReactionBar({ onReact }: { onReact: (emoji: string) => void }) {
  return (
    <div className="fixed bottom-5 left-1/2 z-45 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-full glass px-2 py-2 shadow-2xl">
        {EMOJI.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onReact(e)}
            aria-label={`React ${e}`}
            className="rounded-full px-2.5 py-1.5 text-xl transition-transform duration-150 hover:scale-125 active:scale-95"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
