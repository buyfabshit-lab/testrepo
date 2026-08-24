import { useRef, useState } from "react";
import type { Settings } from "../lib/store";
import { exportBrain } from "../lib/store";
import type { Thought } from "../lib/types";

type Props = {
  settings: Settings;
  onSettings: (next: Partial<Settings>) => void;
  thoughts: Thought[];
  onImport: (json: string) => void;
  onWipe: () => void;
  onReseed: () => void;
  onRefreshRepos: () => void;
  onClose: () => void;
};

export default function SettingsSheet({
  settings,
  onSettings,
  thoughts,
  onImport,
  onWipe,
  onReseed,
  onRefreshRepos,
  onClose,
}: Props) {
  const [confirmWipe, setConfirmWipe] = useState(false);
  const repoCount = new Set(thoughts.map((thought) => thought.repo).filter(Boolean)).size;
  const fileInput = useRef<HTMLInputElement>(null);

  const download = () => {
    const blob = new Blob([exportBrain({ version: 1, thoughts })], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `second-brain-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    onImport(await file.text());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/70 p-4"
      onClick={onClose}
    >
      <div
        className="panel max-h-full w-full max-w-lg overflow-y-auto rounded-2xl p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} aria-label="Close" className="text-mist hover:text-chalk">
            ✕
          </button>
        </div>

        <section className="mb-6">
          <label htmlFor="api-key" className="mb-1 block text-sm font-medium">
            Anthropic API key
          </label>
          <input
            id="api-key"
            type="password"
            value={settings.apiKey}
            onChange={(event) => onSettings({ apiKey: event.target.value.trim() })}
            placeholder="sk-ant-…"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-edge bg-void/60 px-3 py-2 font-mono text-sm outline-none focus:border-mist/60"
          />
          <p className="mt-2 text-xs leading-relaxed text-mist">
            Stored in this browser only, and sent only to api.anthropic.com. Without it the canvas
            still clusters, links and searches — Claude adds the titling, the tagging and the
            answers. Get one at{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer noopener"
              className="text-sky-300 underline underline-offset-2"
            >
              console.anthropic.com
            </a>
            .
          </p>
        </section>

        <section className="mb-6">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={settings.autoEnrich}
              onChange={(event) => onSettings({ autoEnrich: event.target.checked })}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">Label new thoughts automatically</span>
              <span className="block text-xs text-mist">
                One short Claude call per capture, for a title, a kind and tags.
              </span>
            </span>
          </label>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-mist">
            Arrangement
          </h3>
          <div className="mb-2 flex gap-2">
            {(["repo", "topic"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onSettings({ clusterMode: mode })}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm transition ${
                  settings.clusterMode === mode
                    ? "border-chalk text-chalk"
                    : "border-edge text-mist hover:border-mist"
                }`}
              >
                {mode === "repo" ? "Cluster by repo" : "Cluster by topic"}
              </button>
            ))}
          </div>
          <p className="text-xs text-mist">
            By repo, each repository is its own constellation. By topic, bubbles regroup around
            what they are about — so deploy notes from three repos land together.
          </p>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-mist">
            Your data
          </h3>
          <p className="mb-3 text-xs text-mist">
            {thoughts.length} thought{thoughts.length === 1 ? "" : "s"}
            {repoCount > 0 && ` from ${repoCount} repo${repoCount === 1 ? "" : "s"}`}, held in this
            browser's local storage. Nothing is uploaded anywhere. Export before you clear a
            browser. "Reload from repos" picks up the latest{" "}
            <code className="font-mono text-chalk">npm run ingest</code>.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={download}
              className="rounded-xl border border-edge px-3 py-1.5 text-sm transition hover:border-mist"
            >
              Export JSON
            </button>
            <button
              onClick={() => fileInput.current?.click()}
              className="rounded-xl border border-edge px-3 py-1.5 text-sm transition hover:border-mist"
            >
              Import
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                void pick(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <button
              onClick={onRefreshRepos}
              className="rounded-xl border border-edge px-3 py-1.5 text-sm transition hover:border-mist"
            >
              Reload from repos
            </button>
            <button
              onClick={onReseed}
              className="rounded-xl border border-edge px-3 py-1.5 text-sm transition hover:border-mist"
            >
              Reload the demo brain
            </button>
            <button
              onClick={() => (confirmWipe ? (onWipe(), setConfirmWipe(false)) : setConfirmWipe(true))}
              className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                confirmWipe ? "border-red-500 text-red-400" : "border-edge hover:border-mist"
              }`}
            >
              {confirmWipe ? "Really erase everything?" : "Erase everything"}
            </button>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-mist">
            Getting around
          </h3>
          <ul className="space-y-1 text-xs text-mist">
            <li>Drag the background to pan, scroll to zoom, drag a bubble to move it.</li>
            <li>Click a bubble to open it; everything unrelated fades back.</li>
            <li>Enter captures; Shift+Enter adds a line.</li>
            <li>Press <kbd className="font-mono text-chalk">/</kbd> to jump to the ask box, Esc to let go.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
