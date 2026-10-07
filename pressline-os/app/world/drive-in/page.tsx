import Link from "next/link";
import RoomFrame from "@/components/world/RoomFrame";
import ProductGrid from "@/components/world/ProductGrid";
import { openStores, productsFor } from "@/components/world/data";

export const dynamic = "force-dynamic";

/** Drive-In Concession — featured drops (newest products across open stores) + the pop-up group stores. */
export default async function DriveInPage() {
  const stores = await openStores();
  const popups = stores.filter((s) => s.type === "popup");
  const drops = await productsFor(stores, 8);
  const when = (ts: string | null) => (ts ? new Date(ts).toLocaleDateString() : null);
  return (
    <RoomFrame slug="drive-in">
      <section className="mb-8">
        <h2 className="mb-3 text-lg text-mf-gold">Now showing · featured drops</h2>
        <ProductGrid products={drops} checkout="link" empty="No drops on the marquee yet." />
      </section>
      <section>
        <h2 className="mb-3 text-lg text-mf-gold">Pop-up window · group stores</h2>
        {popups.length === 0 ? (
          <p className="panel px-4 py-8 text-center text-sm text-mf-muted">No pop-ups open. Teams, bands, fundraisers — a pop-up store opens here for a window and closes into one production order.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {popups.map((s) => (
              <li key={s.id} className="panel p-4">
                <h3 className="text-base text-mf-cream">{s.name}</h3>
                <p className="mt-1 text-xs text-mf-muted">
                  {s.closes_at ? `Closes ${when(s.closes_at)}` : "Open-ended"}
                  {s.fundraising_pct ? ` · ${Math.round(s.fundraising_pct * (s.fundraising_pct <= 1 ? 100 : 1))}% to the cause` : ""}
                </p>
                <Link href={`/s/${s.slug}`} className="btn mt-3 w-full justify-center">Open /s/{s.slug}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </RoomFrame>
  );
}
