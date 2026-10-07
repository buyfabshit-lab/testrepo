import RoomFrame from "@/components/world/RoomFrame";
import ProductGrid from "@/components/world/ProductGrid";
import { openStore, productsFor } from "@/components/world/data";

export const dynamic = "force-dynamic";

const DC_URL = "https://deathcorps.shop";

/** RF × Death Corps Clubhouse — the Death Corps store (Shopify). Products mirrored here, checkout on deathcorps.shop. */
export default async function RfDcPage() {
  const store = await openStore("death-corps");
  const products = store ? await productsFor([store]) : [];
  return (
    <RoomFrame slug="rf-dc" aside={<a href={DC_URL} target="_blank" rel="noopener noreferrer" className="btn btn-blood">deathcorps.shop ↗</a>}>
      <p className="mb-5 max-w-2xl text-sm text-mf-muted">Death Corps runs its own register on Shopify. What&rsquo;s published from PRESSLINE shows up here; the sale happens on <a href={DC_URL} target="_blank" rel="noopener noreferrer">deathcorps.shop</a>.</p>
      {!store ? (
        <p className="panel px-4 py-10 text-center text-sm text-mf-muted">Clubhouse is dark tonight. Hit <a href={DC_URL} target="_blank" rel="noopener noreferrer">deathcorps.shop</a> directly.</p>
      ) : (
        <ProductGrid products={products} checkout="external" externalHref={DC_URL} empty="Nothing mirrored yet. Publish to shopify and it lands here." />
      )}
    </RoomFrame>
  );
}
