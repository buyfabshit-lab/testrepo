import { useEffect, useState } from "react";
import { PresenceBadge } from "./PresenceBadge";
import type { Fan } from "../lib/fan";

const LINKS = [
  { href: "#live", label: "Live" },
  { href: "#room", label: "The room" },
  { href: "#wall", label: "Wall" },
  { href: "#schedule", label: "Schedule" },
  { href: "#shop", label: "Shop" },
];

export function Header({
  name,
  live,
  presence,
  handles,
  fan,
  onEditHandle,
  cartCount,
  onOpenCart,
}: {
  name: string;
  live: boolean;
  presence: number;
  handles: string[];
  fan: Fan;
  onEditHandle: () => void;
  cartCount: number;
  onOpenCart: () => void;
}) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        stuck ? "backdrop-blur-xl" : ""
      }`}
      style={{
        background: stuck
          ? "linear-gradient(to bottom, color-mix(in oklab, var(--color-void) 88%, transparent), transparent)"
          : "transparent",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-4">
        <a href="#live" className="flex items-center gap-2.5">
          <span className="display-caps text-2xl font-black text-bone">
            {name}
          </span>
          {live && (
            <span className="rounded-full bg-hot-500 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white">
              live
            </span>
          )}
        </a>

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-3 py-1.5 text-sm text-ash transition-colors hover:bg-white/5 hover:text-bone"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <div className="hidden sm:block">
            <PresenceBadge count={presence} handles={handles} />
          </div>

          <button
            type="button"
            onClick={onEditHandle}
            className="flex items-center gap-2 rounded-full glass px-3 py-2 text-xs font-medium text-bone/85 transition-colors hover:text-bone"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: `hsl(${fan.hue} 90% 62%)` }}
            />
            <span className="max-w-[9ch] truncate">{fan.handle}</span>
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            className="relative rounded-full glass px-3.5 py-2 text-xs font-semibold text-bone transition-colors hover:bg-white/5"
            aria-label={`Cart, ${cartCount} items`}
          >
            Cart
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-hot-500 px-1 text-[10px] font-bold tabular-nums text-white">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
