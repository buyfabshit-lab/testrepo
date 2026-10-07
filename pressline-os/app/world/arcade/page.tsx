import Link from "next/link";
import RoomFrame from "@/components/world/RoomFrame";

/** Arcade Cabinet — the Design Studio in arcade mode (black tee + UV sticker), framed like a cabinet. */
export default function ArcadePage() {
  const src = "/design?mode=arcade";
  return (
    <RoomFrame slug="arcade" aside={<Link href={src} className="btn btn-solid">Play full screen</Link>}>
      <div className="mx-auto max-w-4xl">
        <div className="relative rounded-t-[28px] border-4 border-mf-line bg-mf-panel p-3 shadow-[0_0_40px_rgba(212,169,79,.12)]">
          <div className="flex items-center justify-between px-3 pb-3">
            <span className="font-[family-name:var(--font-display)] text-xl uppercase tracking-[.2em] text-mf-gold">Midnight Arcade</span>
            <span className="flex items-center gap-1" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-mf-blood" />
              <span className="h-2.5 w-2.5 rounded-full bg-mf-gold" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#16a34a]" />
            </span>
          </div>
          <div className="rounded-lg border-8 border-[#0a0908] bg-black">
            <iframe src={src} title="Design Studio — arcade mode" className="aspect-[4/3] w-full bg-mf-bg sm:aspect-[16/10]" loading="lazy" allow="clipboard-write" />
          </div>
          <div className="mt-3 flex items-center justify-between px-3 pb-1 text-[10px] uppercase tracking-[.2em] text-mf-dim">
            <span>Black tee · UV sticker</span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-6 rounded-sm border border-mf-gold" aria-hidden />
              Insert coin
            </span>
          </div>
        </div>
        <div className="mx-auto h-10 w-[92%] rounded-b-xl border-x-4 border-b-4 border-mf-line bg-mf-panel" aria-hidden />
        <p className="mt-4 text-center text-xs text-mf-muted">Same studio as <Link href="/design">/design</Link>. Arcade mode locks the blank to black and the method to UV sticker.</p>
      </div>
    </RoomFrame>
  );
}
