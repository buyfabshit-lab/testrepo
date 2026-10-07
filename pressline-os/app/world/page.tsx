import ClubhouseMap from "@/components/world/Map";
import { FlatMenu } from "@/components/world/RoomFrame";
import { laneCounts } from "@/components/world/data";

export const dynamic = "force-dynamic";

/** The lot: the building cutaway + the flat menu (always rendered; first on phones). */
export default async function WorldPage() {
  const counts = await laneCounts();
  const live = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5">
        <p className="text-[10px] uppercase tracking-[.25em] text-mf-dim">Midnight Fusion · The World</p>
        <h1 className="mt-1 text-4xl text-mf-gold sm:text-5xl">Death Squad Clubhouse</h1>
        <p className="mt-2 max-w-2xl text-sm text-mf-muted">
          Thirteen rooms, one shop. Pick a door. {live > 0 ? `${live} order${live === 1 ? "" : "s"} moving on the floor right now.` : "Floor's quiet."}
        </p>
      </header>
      {/* Phones get the list first; the map is a bonus above lg. The list always renders. */}
      <div className="flex flex-col gap-6 lg:flex-col-reverse">
        <FlatMenu />
        <div className="hidden sm:block">
          <ClubhouseMap laneCounts={counts} />
        </div>
      </div>
    </div>
  );
}
