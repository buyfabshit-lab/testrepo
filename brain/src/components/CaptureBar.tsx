import { useState } from "react";
import type { KeyboardEvent } from "react";

type Props = {
  onCapture: (text: string) => void;
  /** True while Claude is labelling at least one bubble. */
  busy: boolean;
};

export default function CaptureBar({ onCapture, busy }: Props) {
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    onCapture(text);
    setText("");
  };

  // Enter saves. Shift+Enter is for the rare multi-paragraph capture.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="panel pointer-events-auto flex items-end gap-2 rounded-2xl p-2 shadow-2xl shadow-black/60">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder="Anything. A thought, a link, a name, a thing to do…"
        aria-label="Capture a thought"
        className="max-h-40 min-h-[2.6rem] flex-1 resize-none bg-transparent px-3 py-2 text-[15px] text-chalk outline-none placeholder:text-mist/60"
        style={{ height: `${Math.min(160, 42 + text.split("\n").length * 20)}px` }}
      />
      <button
        onClick={submit}
        disabled={!text.trim()}
        className="mb-1 shrink-0 rounded-xl bg-chalk px-4 py-2 text-sm font-semibold text-void transition disabled:cursor-not-allowed disabled:bg-edge disabled:text-mist"
      >
        {busy ? "Thinking…" : "Drop it in"}
      </button>
    </div>
  );
}
