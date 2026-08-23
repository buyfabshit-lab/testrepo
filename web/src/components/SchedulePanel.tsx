import { dayLabel, sharesClockWith, shortTime, timeInZone } from "../lib/format";
import type { ScheduleItem } from "../lib/types";

export function SchedulePanel({
  items,
  timezone,
  location,
}: {
  items: ScheduleItem[];
  timezone: string | null;
  location: string | null;
}) {
  if (!items.length) {
    return (
      <div className="rounded-3xl glass p-6 text-sm text-ash">
        Nothing on the calendar yet. Streams get announced in Discord first.
      </div>
    );
  }

  const now = Date.now();
  const zone = timezone ?? "";

  return (
    <>
      <ol className="space-y-3">
        {items.map((item) => {
          const start = new Date(item.starts_at).getTime();
          const ends = start + (item.duration_min ?? 0) * 60_000;
          const running = now >= start && now < ends;

          // Times render in the viewer's own zone. DIME's is shown alongside
          // only when it actually differs, so a New York fan isn't told the
          // same time twice.
          const sameClock = sharesClockWith(item.starts_at, zone);
          const dimeTime = sameClock ? null : timeInZone(item.starts_at, zone);

          return (
            <li
              key={item.id}
              className={`flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl glass px-5 py-4 transition-colors ${
                running ? "glow-hot" : ""
              }`}
            >
              <div className="w-28 shrink-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-hot-400">
                  {dayLabel(item.starts_at)}
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-bone">
                  {shortTime(item.starts_at)}
                </p>
                {dimeTime && (
                  <p className="mt-0.5 font-mono text-[10px] tabular-nums text-ash">
                    {dimeTime} for {location ?? "DIME"}
                  </p>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-medium text-bone">
                  {item.title}
                  {running && (
                    <span className="ml-2 rounded-full bg-hot-500 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white">
                      on now
                    </span>
                  )}
                </p>
                {item.description && (
                  <p className="mt-0.5 text-sm text-ash">{item.description}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3 text-xs text-ash">
                {item.duration_min && (
                  <span className="tabular-nums">
                    ~{Math.round(item.duration_min / 60)}h
                  </span>
                )}
                {item.platform && (
                  <span className="rounded-full bg-white/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider">
                    {item.platform}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-xs text-ash">
        Times shown in your timezone
        {location ? `; DIME streams out of ${location}` : ""}.
      </p>
    </>
  );
}
