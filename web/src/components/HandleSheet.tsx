import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Fan } from "../lib/fan";

export function HandleSheet({
  open,
  fan,
  onClose,
  onSave,
}: {
  open: boolean;
  fan: Fan;
  onClose: () => void;
  onSave: (next: Fan) => void;
}) {
  const [handle, setHandle] = useState(fan.handle);
  const [hue, setHue] = useState(fan.hue);

  useEffect(() => {
    if (open) {
      setHandle(fan.handle);
      setHue(fan.hue);
    }
  }, [open, fan]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-60 flex items-center justify-center p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-void/75 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Your handle"
            initial={{ y: 24, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 200, damping: 24 }}
            className="relative w-full max-w-sm rounded-3xl glass p-6"
          >
            <h3 className="font-display text-xl font-extrabold text-bone">
              Who are you tonight?
            </h3>
            <p className="mt-1.5 text-sm text-ash">
              No account, no email. Just a name the room can see.
            </p>

            <label className="mt-5 block">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                handle
              </span>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value.slice(0, 24))}
                maxLength={24}
                autoFocus
                className="mt-1.5 w-full rounded-xl bg-white/5 px-4 py-3 text-bone outline-none ring-hot-500/60 focus:ring-2"
              />
            </label>

            <label className="mt-4 block">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                colour
              </span>
              <input
                type="range"
                min={0}
                max={360}
                value={hue}
                onChange={(e) => setHue(Number(e.target.value))}
                className="mt-2 w-full accent-hot-500"
                style={{
                  background:
                    "linear-gradient(90deg, hsl(0 90% 62%), hsl(60 90% 62%), hsl(120 90% 62%), hsl(180 90% 62%), hsl(240 90% 62%), hsl(300 90% 62%), hsl(360 90% 62%))",
                  height: 6,
                  borderRadius: 999,
                }}
              />
            </label>

            <div className="mt-5 flex items-center gap-2 rounded-xl bg-white/5 px-4 py-3">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: `hsl(${hue} 90% 62%)` }}
              />
              <span className="font-semibold" style={{ color: `hsl(${hue} 88% 68%)` }}>
                {handle || "…"}
              </span>
              <span className="text-sm text-ash">is how you'll show up</span>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full bg-white/5 px-4 py-3 text-sm font-medium text-ash transition-colors hover:text-bone"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!handle.trim()}
                onClick={() => {
                  onSave({ ...fan, handle: handle.trim().slice(0, 24), hue });
                  onClose();
                }}
                className="flex-1 rounded-full bg-hot-500 px-4 py-3 text-sm font-semibold text-white transition disabled:bg-white/8 disabled:text-ash"
              >
                Save
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
