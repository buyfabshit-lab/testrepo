import RoomFrame from "@/components/world/RoomFrame";
import ProductGrid from "@/components/world/ProductGrid";
import { openStore, productsFor } from "@/components/world/data";

export const dynamic = "force-dynamic";

/** Skrew U Lot — Skrew U listings (store slug skrew-u). Checkout through POST /api/stores/skrew-u/orders. */
export default async function SkrewULotPage() {
  const store = await openStore("skrew-u");
  const products = store ? await productsFor([store]) : [];
  return (
    <RoomFrame slug="skrewu-lot" aside={store ? <span className="badge border border-[#16a34a] text-[#16a34a]">Open</span> : <span className="badge border border-mf-line text-mf-dim">Closed</span>}>
      {!store ? (
        <p className="panel px-4 py-10 text-center text-sm text-mf-muted">Lot&rsquo;s chained off. Skrew U store is closed.</p>
      ) : (
        <ProductGrid products={products} checkout="stripe" empty="Lot's empty. Publish to skrewu and the listings park here." />
      )}
    </RoomFrame>
  );
}
