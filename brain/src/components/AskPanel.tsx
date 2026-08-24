import { useRef, useState } from "react";
import type { Thought } from "../lib/types";
import { KIND_HUE } from "../lib/types";
import type { Graph } from "../lib/graph";
import { search } from "../lib/graph";
import { snippet } from "../lib/text";
import { ask, describeError, shortId } from "../lib/claude";

type Props = {
  thoughts: Thought[];
  graph: Graph;
  apiKey: string;
  onHighlight: (ids: string[]) => void;
  onGoTo: (id: string) => void;
};

export default function AskPanel({ thoughts, graph, apiKey, onHighlight, onGoTo }: Props) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [found, setFound] = useState<Thought[]>([]);
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);

  const run = async () => {
    const query = question.trim();
    if (!query || state === "working") return;

    // Retrieval is local and always runs — it is what lights up the canvas.
    const hits = search(query, thoughts, graph);
    setFound(hits);
    onHighlight(hits.map((hit) => hit.id));
    setAnswer("");
    setError("");

    if (!apiKey) {
      setState("done");
      return;
    }

    setState("working");
    abort.current?.abort();
    abort.current = new AbortController();
    try {
      const result = await ask(
        apiKey,
        query,
        hits,
        (delta) => setAnswer((current) => current + delta),
        abort.current.signal,
      );
      // Narrow the glow to the bubbles the answer actually leaned on.
      if (result.citedIds.length) onHighlight(result.citedIds);
      setState("done");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(describeError(caught));
      setState("error");
    }
  };

  const clear = () => {
    abort.current?.abort();
    setQuestion("");
    setAnswer("");
    setFound([]);
    setError("");
    setState("idle");
    onHighlight([]);
  };

  return (
    <section className="panel pointer-events-auto flex max-h-[60vh] flex-col rounded-2xl shadow-2xl shadow-black/60">
      <div className="flex items-center gap-2 p-2">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && run()}
          placeholder={apiKey ? "Ask your brain…" : "Search your brain…"}
          aria-label="Ask your brain"
          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-mist/60"
        />
        {(answer || found.length > 0 || question) && (
          <button
            onClick={clear}
            className="shrink-0 rounded-lg px-2 py-1 text-xs text-mist transition hover:text-chalk"
          >
            Clear
          </button>
        )}
        <button
          onClick={run}
          disabled={!question.trim() || state === "working"}
          className="shrink-0 rounded-xl bg-chalk px-3 py-1.5 text-xs font-semibold text-void transition disabled:bg-edge disabled:text-mist"
        >
          {state === "working" ? "…" : apiKey ? "Ask" : "Find"}
        </button>
      </div>

      {(answer || state === "working" || error || found.length > 0) && (
        <div className="space-y-3 overflow-y-auto border-t border-edge p-3">
          {error && <p className="text-sm text-red-400">{error}</p>}

          {(answer || state === "working") && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {answer || <span className="text-mist">Reading your notes…</span>}
              {state === "working" && answer && <span className="animate-pulse">▍</span>}
            </p>
          )}

          {found.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-mist">
                {apiKey ? "Read from" : "Found in your brain"}
              </h3>
              <ul className="space-y-0.5">
                {found.map((hit) => (
                  <li key={hit.id}>
                    <button
                      onClick={() => onGoTo(hit.id)}
                      className="w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-haze"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: `hsl(${KIND_HUE[hit.kind]} 70% 60%)` }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">{hit.title}</span>
                        {apiKey && (
                          <span className="shrink-0 font-mono text-[10px] text-mist/50">
                            {shortId(hit.id)}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block pl-4 text-xs text-mist/70">
                        {snippet(hit.text, question)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {found.length === 0 && state === "done" && !answer && (
            <p className="text-sm text-mist">Nothing in the brain matches that yet.</p>
          )}

          {!apiKey && found.length > 0 && (
            <p className="text-xs text-mist/70">
              Add an API key in settings and this box answers instead of just finding.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
