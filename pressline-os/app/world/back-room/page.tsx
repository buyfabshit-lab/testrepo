import RoomFrame from "@/components/world/RoomFrame";
import ProductGrid from "@/components/world/ProductGrid";
import { openStore, productsFor } from "@/components/world/data";

export const dynamic = "force-dynamic";

/** The Back Room — Death Squad store (Stripe Checkout through POST /api/stores/death-squad/orders). */
export default async function BackRoomPage() {
  const store = await openStore("death-squad");
  const products = store ? await productsFor([store]) : [];
  return (
    <RoomFrame slug="back-room" aside={store ? <span className="badge border border-[#16a34a] text-[#16a34a]">Open</span> : <span className="badge border border-mf-line text-mf-dim">Closed</span>}>
      {!store ? (
        <p className="panel px-4 py-10 text-center text-sm text-mf-muted">Back Room&rsquo;s shuttered. Come back when the store is open.</p>
      ) : (
        <ProductGrid products={products} checkout="stripe" empty="Nothing on the shelf yet. Publish a product to death-squad and it shows up here." />
      )}
    </RoomFrame>
  );
}
