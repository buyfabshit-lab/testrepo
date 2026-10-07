"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export const NAV = [
  { href: "/app/board", label: "Board", glyph: "▦" },
  { href: "/app/orders", label: "Orders", glyph: "≡" },
  { href: "/app/quotes", label: "Quotes", glyph: "$" },
  { href: "/app/calendar", label: "Calendar", glyph: "▣" },
  { href: "/app/customers", label: "Customers", glyph: "☺" },
  { href: "/app/suppliers", label: "Suppliers", glyph: "⛟" },
  { href: "/app/shipping", label: "Shipping", glyph: "➤" },
  { href: "/app/vault", label: "Vault", glyph: "◈" },
  { href: "/app/sales", label: "Sales", glyph: "⚑" },
  { href: "/app/stores", label: "Stores", glyph: "⌂" },
  { href: "/app/settings", label: "Settings", glyph: "⚙" },
  { href: "/app/jeff", label: "Jeff", glyph: "★" },
] as const;

const MOBILE_PRIMARY = ["/app/board", "/app/orders", "/app/jeff", "/app/shipping"];

export function Nav({ role }: { role: string }) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden w-48 shrink-0 border-r border-mf-line bg-mf-panel/60 md:block">
        <ul className="sticky top-14 py-3">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href}
                className={`flex items-center gap-3 px-4 py-2 text-xs font-bold uppercase tracking-[.15em] no-underline ${active(n.href) ? "border-r-2 border-mf-gold bg-mf-bg text-mf-gold" : "text-mf-muted hover:text-mf-cream"}`}>
                <span className="w-4 text-center text-base leading-none" aria-hidden>{n.glyph}</span>{n.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="px-4 pb-4 text-[.6rem] uppercase tracking-widest text-mf-dim">role · {role}</p>
      </nav>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-mf-line bg-mf-panel md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <ul className="grid grid-cols-5">
          {NAV.filter((n) => MOBILE_PRIMARY.includes(n.href)).map((n) => (
            <li key={n.href}>
              <Link href={n.href} onClick={() => setMore(false)}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[.6rem] font-bold uppercase tracking-widest no-underline ${active(n.href) ? "text-mf-gold" : "text-mf-muted"}`}>
                <span className="text-lg leading-none" aria-hidden>{n.glyph}</span>{n.label}
              </Link>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more}
              className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[.6rem] font-bold uppercase tracking-widest ${more ? "text-mf-gold" : "text-mf-muted"}`}>
              <span className="text-lg leading-none" aria-hidden>⋯</span>More
            </button>
          </li>
        </ul>
      </nav>
      {more ? (
        <div className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-x-0 bottom-14 border-t border-mf-line bg-mf-panel p-3" onClick={(e) => e.stopPropagation()}>
            <ul className="grid grid-cols-4 gap-2">
              {NAV.filter((n) => !MOBILE_PRIMARY.includes(n.href)).map((n) => (
                <li key={n.href}>
                  <Link href={n.href} onClick={() => setMore(false)}
                    className={`flex h-16 flex-col items-center justify-center gap-1 border text-[.6rem] font-bold uppercase tracking-widest no-underline ${active(n.href) ? "border-mf-gold text-mf-gold" : "border-mf-line text-mf-muted"}`}>
                    <span className="text-xl leading-none" aria-hidden>{n.glyph}</span>{n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
