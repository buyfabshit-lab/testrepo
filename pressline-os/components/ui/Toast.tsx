"use client";
import { useEffect } from "react";

export type ToastState = { kind: "ok" | "err"; text: string } | null;

export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  if (!toast) return null;
  return (
    <div role="status" className={`fixed bottom-20 left-1/2 z-50 -translate-x-1/2 border px-4 py-2 text-sm shadow-lg md:bottom-6 ${toast.kind === "ok" ? "border-mf-gold bg-mf-panel text-mf-cream" : "border-mf-blood bg-mf-blood text-mf-cream"}`}>
      {toast.text}
    </div>
  );
}
