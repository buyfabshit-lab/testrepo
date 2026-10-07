import Link from "next/link";
import RoomFrame from "@/components/world/RoomFrame";
import { openStores, productsFor } from "@/components/world/data";

export const dynamic = "force-dynamic";

/** The Lot / Lineup Showroom — wholesale portal: stores of type wholesale with tiers + MOQ. */
export default async function ShowroomPage() {
  const stores = await openStores({ type: "wholesale" });
  const products = await productsFor(stores, 60);
  return (
    <RoomFrame slug="showroom">
      {stores.length === 0 ? (
        <p className="panel px-4 py-10 text-center text-sm text-mf-muted">Showroom lights are off. No wholesale lines open.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {stores.map((s) => {
            const line = products.filter((p) => p.storeSlug === s.slug);
            return (
              <section key={s.id} className="panel">
                <div className="flex flex-wrap items-end justify-between gap-2 border-b border-mf-line px-4 py-3">
                  <div>
                    <h2 className="text-xl text-mf-gold">{s.name}</h2>
                    <p className="text-[10px] uppercase tracking-[.14em] text-mf-dim">Wholesale · /s/{s.slug}</p>
                  </div>
                  <Link href={`/s/${s.slug}`} className="btn">Open the line</Link>
                </div>
                <div className="grid gap-4 p-4 sm:grid-cols-[180px_1fr]">
                  <div>
                    <p className="label">Minimum</p>
                    <p className="font-mono text-3xl text-mf-cream">{s.moq ?? "—"}<span className="ml-1 text-xs text-mf-dim">pcs</span></p>
                    <p className="label mt-4">Tiers</p>
                    {s.tiers.length === 0 ? <p className="text-sm text-mf-muted">Ask for terms.</p> : (
                      <ul className="space-y-1 font-mono text-sm">
                        {s.tiers.map((t) => <li key={t.min} className="flex justify-between gap-3"><span className="text-mf-muted">{t.min}+</span><span className="text-mf-gold">{Math.round(t.pct * 100)}% off</span></li>)}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="label">On the rack · {line.length}</p>
                    {line.length === 0 ? <p className="text-sm text-mf-muted">Rack&rsquo;s bare. Publish to wholesale and it hangs here.</p> : (
                      <ul className="divide-y divide-mf-line text-sm">
                        {line.slice(0, 8).map((p) => (
                          <li key={p.id} className="flex justify-between gap-3 py-1.5"><span className="truncate">{p.title}</span><span className="shrink-0 font-mono text-mf-gold">{typeof p.price === "number" ? `$${p.price.toFixed(2)}` : "—"}</span></li>
                        ))}
                        {line.length > 8 && <li className="py-1.5 text-xs text-mf-dim">+{line.length - 8} more on /s/{s.slug}</li>}
                      </ul>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </RoomFrame>
  );
}
