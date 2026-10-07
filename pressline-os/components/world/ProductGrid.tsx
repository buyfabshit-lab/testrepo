import Link from "next/link";
import type { PublicProduct } from "./data";
import BuyBox from "./BuyBox";

/**
 * Store shelf. `checkout="stripe"` adds the BuyBox (POST /api/stores/:slug/orders);
 * `checkout="link"` sends to `/s/[slug]`; `checkout="external"` opens the outside store.
 */
export default function ProductGrid({ products, checkout, externalHref, empty }: {
  products: PublicProduct[];
  checkout: "stripe" | "link" | "external" | "none";
  externalHref?: string;
  empty?: string;
}) {
  if (!products.length) return <p className="panel px-4 py-8 text-center text-sm text-mf-muted">{empty ?? "Shelves are empty. Nothing published to this store yet."}</p>;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <li key={p.id} className="panel flex flex-col gap-3 p-3">
          <div className="aspect-square w-full overflow-hidden bg-mf-bg">
            {p.mockup ? (
              // eslint-disable-next-line @next/next/no-img-element -- mockups are remote URLs from the products table
              <img src={p.mockup} alt={p.title} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[.2em] text-mf-dim">no mockup</div>
            )}
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-base text-mf-cream">{p.title}</h3>
            <span className="shrink-0 font-mono text-sm text-mf-gold">{typeof p.price === "number" ? `$${p.price.toFixed(2)}` : "—"}</span>
          </div>
          {checkout === "stripe" && <BuyBox storeSlug={p.storeSlug} productId={p.id} />}
          {checkout === "link" && <Link href={`/s/${p.storeSlug}`} className="btn w-full justify-center">Open store</Link>}
          {checkout === "external" && externalHref && <a href={externalHref} target="_blank" rel="noopener noreferrer" className="btn w-full justify-center">Shop it ↗</a>}
        </li>
      ))}
    </ul>
  );
}
