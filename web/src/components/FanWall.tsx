import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { relative } from "../lib/format";
import type { WallPost } from "../lib/types";
import type { Fan } from "../lib/fan";

export function FanWall({
  posts,
  post,
  heart,
  hearted,
  error,
  fan,
}: {
  posts: WallPost[];
  post: (body: string) => Promise<boolean>;
  heart: (id: number) => void;
  hearted: Set<number>;
  error: string | null;
  fan: Fan;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    const text = draft;
    setDraft("");
    const ok = await post(text);
    if (!ok) setDraft(text);
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="rounded-3xl glass p-5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Leave something for DIME. This one sticks around."
          aria-label="Wall post"
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-bone outline-none placeholder:text-ash/70"
        />
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/8 pt-3">
          <span className="flex items-center gap-2 text-xs text-ash">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: `hsl(${fan.hue} 90% 62%)` }}
            />
            signing as <span className="font-medium text-bone/80">{fan.handle}</span>
          </span>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] tabular-nums text-ash">
              {draft.length}/500
            </span>
            <button
              type="submit"
              disabled={!draft.trim() || busy}
              className="rounded-full bg-hot-500 px-5 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-white/8 disabled:text-ash"
            >
              Sign the wall
            </button>
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-hot-400">{error}</p>}
      </form>

      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        <AnimatePresence initial={false}>
          {posts.map((p) => (
            <motion.article
              key={p.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 160, damping: 22 }}
              className="mb-4 break-inside-avoid rounded-2xl glass p-4"
              style={{
                borderColor: `hsl(${p.hue} 80% 60% / 0.25)`,
              }}
            >
              <p className="text-[15px] leading-relaxed text-bone/90">{p.body}</p>
              <div className="mt-3.5 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs">
                  <span
                    className="font-semibold"
                    style={{ color: `hsl(${p.hue} 88% 68%)` }}
                  >
                    {p.handle}
                  </span>
                  <span className="ml-2 text-ash">{relative(p.created_at)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => heart(p.id)}
                  disabled={hearted.has(p.id)}
                  aria-label={`Heart post by ${p.handle}`}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition ${
                    hearted.has(p.id)
                      ? "cursor-default bg-hot-500/15 text-hot-400"
                      : "text-ash hover:bg-white/5 hover:text-bone"
                  }`}
                >
                  <span className={hearted.has(p.id) ? "" : "grayscale"}>♥</span>
                  <span className="tabular-nums">{p.hearts}</span>
                </button>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>

      {posts.length === 0 && (
        <p className="py-10 text-center text-sm text-ash">
          The wall is blank. Somebody has to go first.
        </p>
      )}
    </div>
  );
}
