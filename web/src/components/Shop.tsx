import { money } from "../lib/format";
import type { Product } from "../lib/types";

function Placeholder({ name, index }: { name: string; index: number }) {
  const hue = (index * 47 + 310) % 360;
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: `radial-gradient(120% 120% at 30% 15%, hsl(${hue} 85% 55% / 0.5), transparent 60%), linear-gradient(150deg, #17131f, #0c0a11)`,
      }}
    >
      <span className="px-6 text-center font-display text-2xl font-extrabold leading-tight tracking-tight text-bone/25">
        {name}
      </span>
    </div>
  );
}

export function Shop({
  products,
  onAdd,
}: {
  products: Product[];
  onAdd: (p: Product) => void;
}) {
  if (!products.length) {
    return (
      <div className="rounded-3xl glass p-6 text-sm text-ash">
        The drop isn't live yet. Check back.
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p, i) => {
        const soldOut = p.stock !== null && p.stock <= 0;
        return (
          <article
            key={p.id}
            className="group flex flex-col overflow-hidden rounded-3xl glass transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt={p.name}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <Placeholder name={p.name} index={i} />
              )}
              {p.tags.includes("bestseller") && (
                <span className="absolute left-3 top-3 rounded-full bg-gold-400 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-void">
                  bestseller
                </span>
              )}
              {soldOut && (
                <span className="absolute right-3 top-3 rounded-full bg-void/85 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-ash">
                  sold out
                </span>
              )}
            </div>

            <div className="flex flex-1 flex-col p-5">
              <h3 className="font-display text-lg font-bold leading-tight text-bone">
                {p.name}
              </h3>
              {p.description && (
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ash">
                  {p.description}
                </p>
              )}
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="font-display text-xl font-extrabold tabular-nums text-bone">
                  {money(p.price_cents, p.currency)}
                </span>
                <button
                  type="button"
                  disabled={soldOut}
                  onClick={() => onAdd(p)}
                  className="rounded-full bg-hot-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/8 disabled:text-ash"
                >
                  {soldOut ? "Sold out" : "Add"}
                </button>
              </div>
              {p.stock !== null && p.stock > 0 && p.stock <= 10 && (
                <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-gold-400">
                  only {p.stock} left
                </p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
