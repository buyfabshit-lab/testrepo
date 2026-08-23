import type { Social } from "../lib/types";

export function Footer({ name, socials, bio }: { name: string; socials: Social[]; bio: string | null }) {
  return (
    <footer className="mt-24 border-t border-white/8 pt-10">
      <div className="grid gap-8 sm:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="font-display text-2xl font-extrabold tracking-tight text-bone">
            {name}
          </p>
          {bio && (
            <p className="mt-3 max-w-md text-balance-pretty text-sm leading-relaxed text-ash">
              {bio}
            </p>
          )}
        </div>

        {socials.length > 0 && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ash">
              elsewhere
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {socials.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-block rounded-full glass px-4 py-2 text-sm text-bone/85 transition-colors hover:text-bone"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-10 pb-28 text-xs text-ash/70">
        © {new Date().getFullYear()} {name}. Chat, wall posts and votes are stored in
        Supabase and visible to everyone in the room.
      </p>
    </footer>
  );
}
