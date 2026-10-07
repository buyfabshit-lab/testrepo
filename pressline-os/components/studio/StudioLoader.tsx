"use client";

import dynamic from "next/dynamic";
import type { StudioMode } from "./Studio";

/** Fabric needs a DOM; load the studio client-only. */
const Studio = dynamic(() => import("./Studio").then((m) => m.Studio), {
  ssr: false,
  loading: () => <div className="panel m-4 p-10 text-center text-sm text-mf-muted sm:mx-0">Warming up the press…</div>,
});

export function StudioLoader({ mode = "studio" }: { mode?: StudioMode }) {
  return <Studio mode={mode} />;
}
