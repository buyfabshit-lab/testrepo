import { useEffect } from "react";

export interface ToastMsg { id: number; text: string; tone?: "ok" | "error" }

export function Toast({ msg, onDone }: { msg: ToastMsg | null; onDone: () => void }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onDone, msg.tone === "error" ? 5000 : 2600);
    return () => clearTimeout(t);
  }, [msg, onDone]);
  if (!msg) return null;
  return <div key={msg.id} className="toast pop" data-tone={msg.tone ?? "ok"}>{msg.text}</div>;
}
