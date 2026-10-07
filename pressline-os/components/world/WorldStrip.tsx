"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { roomByPath } from "./rooms";

/** Top strip of the world chrome. Client-only so it can read the current room off the URL. */
export default function WorldStrip() {
  const pathname = usePathname();
  const room = roomByPath(pathname);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-mf-line bg-mf-panel px-4 py-2">
      <Link href="/world" className="font-[family-name:var(--font-display)] text-lg uppercase tracking-[.18em] text-mf-gold no-underline">
        Death Squad Clubhouse
      </Link>
      <div className="flex min-w-0 items-center gap-3 text-xs">
        <span className="truncate uppercase tracking-[.14em] text-mf-muted" aria-live="polite">{room ? room.name : "The Lot"}</span>
        {room && <Link href="/world" className="shrink-0 uppercase tracking-[.14em] text-mf-gold">Back to the lot</Link>}
      </div>
    </div>
  );
}
