import RoomFrame from "@/components/world/RoomFrame";
import { LANES, laneCounts, lastGangRun } from "@/components/world/data";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/orders/status";

export const dynamic = "force-dynamic";

/** Print Floor / Garage Bays — the production board, read-only, plus Outlaw's last run report. */
export default async function FloorPage() {
  const [counts, run] = await Promise.all([laneCounts(), lastGangRun()]);
  const total = LANES.reduce((a, l) => a + (counts[l] ?? 0), 0);
  return (
    <RoomFrame slug="floor" aside={<span className="text-mf-muted">{total} on the board</span>}>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-3 text-lg text-mf-gold">Lanes</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {LANES.map((lane) => {
              const c = STATUS_COLORS[lane], n = counts[lane] ?? 0;
              return (
                <li key={lane} className="panel flex items-center gap-3 p-3" style={{ borderLeft: `4px solid ${c.hex}` }}>
                  <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: c.hex }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] uppercase tracking-[.14em] text-mf-muted">{STATUS_LABELS[lane]}</span>
                    <span className="block font-mono text-2xl text-mf-cream">{n}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-mf-dim">Read-only from the floor. Moves happen on the dashboard board; the colors are the same there.</p>
        </section>
        <section className="panel">
          <h2 className="border-b border-mf-line px-4 py-3 text-lg text-mf-gold">Outlaw&rsquo;s last run report</h2>
          {run ? (
            <div className="space-y-3 p-4 text-sm">
              <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-mf-muted">
                <span>run {run.run_date ?? run.created_at?.slice(0, 10) ?? "—"}</span>
                <span>{run.sheets} sheet{run.sheets === 1 ? "" : "s"}</span>
                <span>{run.designs} design{run.designs === 1 ? "" : "s"}</span>
                <span className={run.sent_to_danny_at ? "text-[#16a34a]" : "text-[#eab308]"}>{run.sent_to_danny_at ? "sent to Danny" : "not sent yet"}</span>
              </p>
              <pre className="whitespace-pre-wrap border-l-2 border-mf-gold pl-3 font-sans text-mf-cream">{run.report ?? "No report text on this run."}</pre>
            </div>
          ) : (
            <p className="px-4 py-8 text-sm text-mf-muted">No gang run on file. The nightly build writes one here.</p>
          )}
        </section>
      </div>
    </RoomFrame>
  );
}
