import type { Metadata } from "next";
import WorldStrip from "@/components/world/WorldStrip";
import Link from "next/link";
import IntercomTicker from "@/components/world/IntercomTicker";

export const metadata: Metadata = {
  title: { default: "Death Squad Clubhouse", template: "%s · Clubhouse" },
  description: "The World — every room is a skin over the same PRESSLINE data.",
};

/** World chrome: top strip (clubhouse name, current room, back to the lot) + the persistent Intercom ticker. */
export default function WorldLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-mf-bg text-mf-cream">
      <div className="sticky top-0 z-20">
        <WorldStrip />
        <IntercomTicker />
      </div>
      <main>{children}</main>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-[10px] uppercase tracking-[.2em] text-mf-dim">
        Everybody can print. Nobody can do what we do. · <Link href="/" className="text-mf-dim">PRESSLINE OS</Link>
      </footer>
    </div>
  );
}
