import Link from "next/link";
import { ROOMS, roomBySlug, roomHref, type RoomSlug } from "./rooms";

/** Flat list of every room. Always rendered (map fallback + the primary UI on phones). */
export function FlatMenu({ current }: { current?: RoomSlug }) {
  return (
    <nav aria-label="All rooms" className="panel">
      <p className="border-b border-mf-line px-4 py-2 text-[10px] uppercase tracking-[.2em] text-mf-dim">Flat menu · every room</p>
      <ul className="divide-y divide-mf-line">
        {ROOMS.map((r) => (
          <li key={r.slug}>
            <Link href={roomHref(r.slug)} aria-current={r.slug === current ? "page" : undefined}
              className={`flex items-center justify-between gap-3 px-4 py-3 hover:bg-mf-bg ${r.slug === current ? "bg-mf-bg text-mf-gold" : "text-mf-cream"}`}>
              <span>
                <span className="block font-semibold tracking-wide">{r.name}{r.locked ? <span className="ml-2 badge border border-mf-blood text-mf-blood">PIN</span> : null}</span>
                <span className="block text-xs text-mf-muted">{r.tag}</span>
              </span>
              <span className="shrink-0 text-[10px] uppercase tracking-[.14em] text-mf-dim">{r.module}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Shared room chrome: header (name, tagline, module) + the content + the flat menu underneath. */
export default function RoomFrame({ slug, aside, children }: { slug: RoomSlug; aside?: React.ReactNode; children: React.ReactNode }) {
  const room = roomBySlug(slug);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-mf-line pb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[.25em] text-mf-dim">{room?.module ?? "Room"}</p>
          <h1 className="mt-1 text-3xl text-mf-gold sm:text-4xl">{room?.name ?? slug}</h1>
          {room?.tag && <p className="mt-1 text-sm text-mf-muted">{room.tag}</p>}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {aside}
          <Link href="/world" className="btn">Back to the lot</Link>
        </div>
      </header>
      <section>{children}</section>
      <div className="mt-10">
        <FlatMenu current={slug} />
      </div>
    </div>
  );
}
