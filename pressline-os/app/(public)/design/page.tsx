import type { Metadata } from "next";
import { StudioLoader } from "@/components/studio/StudioLoader";

export const metadata: Metadata = { title: "Design Studio" };

export default function DesignPage() {
  return (
    <section className="mx-auto max-w-7xl px-0 sm:px-4 sm:py-6">
      <div className="px-4 pt-6 sm:px-0 sm:pt-0">
        <p className="text-xs uppercase tracking-[.3em] text-mf-muted">Design Studio</p>
        <h1 className="mt-1 text-3xl text-mf-gold sm:text-4xl">Make it real</h1>
      </div>
      <StudioLoader />
    </section>
  );
}
