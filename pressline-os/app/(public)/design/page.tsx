import type { Metadata } from "next";
import { StudioLoader } from "@/components/studio/StudioLoader";

export const metadata: Metadata = { title: "Design Studio" };

/** `/design?mode=arcade` is what the World's Arcade Cabinet iframes: no heading, black tee, chrome hidden by PublicChrome. */
export default async function DesignPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const sp = await searchParams;
  const mode = sp.mode === "arcade" ? "arcade" : "studio";
  return (
    <section className={`mx-auto max-w-7xl px-0 sm:px-4 ${mode === "arcade" ? "sm:py-2" : "sm:py-6"}`}>
      {mode !== "arcade" && (
        <div className="px-4 pt-6 sm:px-0 sm:pt-0">
          <p className="text-xs uppercase tracking-[.3em] text-mf-muted">Design Studio</p>
          <h1 className="mt-1 text-3xl text-mf-gold sm:text-4xl">Make it real</h1>
        </div>
      )}
      <StudioLoader mode={mode} />
    </section>
  );
}
