import { useEffect, useState } from "react";
import type { Thought } from "../lib/types";
import { KINDS } from "../lib/types";
import type { Graph } from "../lib/graph";

type Props = {
  thought: Thought;
  graph: Graph;
  thoughts: Thought[];
  pending: boolean;
  hasKey: boolean;
  onPatch: (id: string, changes: Partial<Thought>) => void;
  onRemove: (id: string) => void;
  onRelabel: (id: string) => void;
  onGoTo: (id: string) => void;
  onClose: () => void;
};

export default function DetailPanel({
  thought,
  graph,
  thoughts,
  pending,
  hasKey,
  onPatch,
  onRemove,
  onRelabel,
  onGoTo,
  onClose,
}: Props) {
  const [draft, setDraft] = useState(thought.text);
  const [title, setTitle] = useState(thought.title);
  const [tagDraft, setTagDraft] = useState("");

  // Opening a different bubble replaces the drafts rather than merging them.
  useEffect(() => {
    setDraft(thought.text);
    setTitle(thought.title);
    setTagDraft("");
  }, [thought.id, thought.text, thought.title]);

  const byId = new Map(thoughts.map((item) => [item.id, item]));
  const related = (graph.neighbours.get(thought.id) ?? [])
    .map((link) => {
      const otherId = link.a === thought.id ? link.b : link.a;
      return { thought: byId.get(otherId), weight: link.weight };
    })
    .filter((item): item is { thought: Thought; weight: number } => Boolean(item.thought))
    .slice(0, 8);

  const hue = graph.hueOf.get(thought.id) ?? 210;
  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-");
    if (!tag || thought.tags.includes(tag)) return;
    onPatch(thought.id, { tags: [...thought.tags, tag] });
  };

  return (
    <aside className="panel pointer-events-auto flex h-full w-full flex-col rounded-2xl shadow-2xl shadow-black/60">
      <header className="flex items-start gap-3 border-b border-edge p-4">
        <span
          className="mt-1 h-3 w-3 shrink-0 rounded-full"
          style={{ background: `hsl(${hue} 70% 60%)` }}
          aria-hidden
        />
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => title.trim() && title !== thought.title && onPatch(thought.id, { title: title.trim() })}
          aria-label="Title"
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold leading-tight outline-none"
        />
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-lg px-2 py-1 text-mist transition hover:bg-haze hover:text-chalk"
        >
          ✕
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {thought.summary && <p className="text-sm italic text-mist">{thought.summary}</p>}

        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => draft !== thought.text && onPatch(thought.id, { text: draft })}
          aria-label="Thought text"
          className="min-h-40 w-full resize-y rounded-xl border border-edge bg-void/50 p-3 text-[15px] leading-relaxed outline-none focus:border-mist/50"
        />

        <div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {thought.tags.map((tag) => (
              <button
                key={tag}
                onClick={() =>
                  onPatch(thought.id, { tags: thought.tags.filter((item) => item !== tag) })
                }
                title="Remove tag"
                className="rounded-full border border-edge px-2.5 py-1 text-xs text-mist transition hover:border-mist hover:text-chalk"
              >
                {tag} <span className="opacity-50">×</span>
              </button>
            ))}
            <input
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addTag(tagDraft);
                  setTagDraft("");
                }
              }}
              placeholder="+ tag"
              aria-label="Add a tag"
              className="w-20 rounded-full border border-dashed border-edge bg-transparent px-2.5 py-1 text-xs outline-none placeholder:text-mist/60 focus:border-mist"
            />
          </div>
          <p className="text-xs text-mist/70">
            Tags are the gravity: bubbles sharing one drift together.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={thought.kind}
            onChange={(event) => onPatch(thought.id, { kind: event.target.value as Thought["kind"] })}
            aria-label="Kind"
            className="rounded-lg border border-edge bg-haze px-2 py-1 text-chalk outline-none"
          >
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
          <button
            onClick={() => onPatch(thought.id, { pinned: !thought.pinned })}
            className={`rounded-lg border px-2.5 py-1 transition ${
              thought.pinned ? "border-chalk text-chalk" : "border-edge text-mist hover:text-chalk"
            }`}
          >
            {thought.pinned ? "Pinned" : "Pin"}
          </button>
          {hasKey && (
            <button
              onClick={() => onRelabel(thought.id)}
              disabled={pending}
              className="rounded-lg border border-edge px-2.5 py-1 text-mist transition hover:text-chalk disabled:opacity-50"
            >
              {pending ? "Relabelling…" : "Relabel with Claude"}
            </button>
          )}
          <span className="text-mist/60">
            {new Date(thought.createdAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>

        {thought.source && (
          <a
            href={thought.source}
            target="_blank"
            rel="noreferrer noopener"
            className="block truncate text-xs text-sky-300 underline underline-offset-2"
          >
            {thought.source}
          </a>
        )}

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-mist">
            Drifts near
          </h3>
          {related.length === 0 ? (
            <p className="text-sm text-mist/70">
              Nothing close yet. Give it a tag and it will find its neighbours.
            </p>
          ) : (
            <ul className="space-y-1">
              {related.map(({ thought: other, weight }) => (
                <li key={other.id}>
                  <button
                    onClick={() => onGoTo(other.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-haze"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: `hsl(${graph.hueOf.get(other.id) ?? 210} 70% 60%)` }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{other.title}</span>
                    <span className="shrink-0 font-mono text-[10px] text-mist/60">
                      {Math.round(weight * 100)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <footer className="border-t border-edge p-3">
        <button
          onClick={() => onRemove(thought.id)}
          className="rounded-lg px-2 py-1 text-xs text-mist transition hover:text-red-400"
        >
          Pop this bubble
        </button>
      </footer>
    </aside>
  );
}
