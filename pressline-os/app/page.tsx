import Link from "next/link";

const faces = [
  { href: "/app", title: "Command Dashboard", who: "Justin · Jeff · Danny", what: "Quotes, orders, board, calendar, suppliers, shipping, sales engine." },
  { href: "/design", title: "Design Studio", who: "Customers", what: "Real blanks, the Vault, camo fills, text, upload. Make it real." },
  { href: "/world", title: "The World", who: "Everyone", what: "Death Squad Clubhouse — every room is a skin over the same data." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <p className="text-xs tracking-[.3em] uppercase text-mf-muted">Midnight Fusion LLC</p>
      <h1 className="mt-2 text-5xl text-mf-gold">PRESSLINE OS</h1>
      <p className="mt-4 max-w-xl text-mf-muted">Printavo runs the shop. PRESSLINE runs the shop, makes the art, hunts the customers, and lives inside the Clubhouse.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {faces.map((f) => (
          <Link key={f.href} href={f.href} className="panel block p-5 hover:border-mf-gold">
            <h2 className="text-xl text-mf-gold">{f.title}</h2>
            <p className="mt-1 text-xs uppercase tracking-widest text-mf-dim">{f.who}</p>
            <p className="mt-3 text-sm text-mf-muted">{f.what}</p>
          </Link>
        ))}
      </div>
      <p className="mt-12 text-xs text-mf-dim">Everybody can print. Nobody can do what we do.</p>
    </main>
  );
}
