import Link from "next/link";

/** Minimal customer-facing shell: wordmark up top, the line down below. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-mf-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-display text-lg uppercase tracking-[.25em] text-mf-gold no-underline">
            Midnight Fusion
          </Link>
          <nav className="flex gap-4 text-[11px] uppercase tracking-[.18em] text-mf-muted">
            <Link href="/design" className="text-mf-muted hover:text-mf-gold">Design</Link>
            <Link href="/join" className="text-mf-muted hover:text-mf-gold">Join</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-mf-line">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-mf-dim">Everybody can print. Nobody can do what we do.</p>
      </footer>
    </div>
  );
}
