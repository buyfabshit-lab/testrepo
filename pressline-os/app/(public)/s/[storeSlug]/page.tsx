import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase/service";
import { signedUrls } from "@/lib/supabase/storage";
import type { BlankRow, ProductRow, StoreRow } from "@/lib/supabase/types";
import { StoreFront, type StoreProduct, type Tier } from "@/components/studio/StoreFront";

export const dynamic = "force-dynamic";

type ProductWithBlank = ProductRow & { blank: BlankRow | null };

export async function generateMetadata({ params }: { params: Promise<{ storeSlug: string }> }): Promise<Metadata> {
  const { storeSlug } = await params;
  const { data } = await db().from("stores").select("name").eq("slug", storeSlug).maybeSingle();
  return { title: data?.name ?? "Store" };
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export default async function StorePage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const { data: store } = await db().from("stores").select("*").eq("slug", storeSlug).in("type", ["popup", "wholesale"]).maybeSingle();
  if (!store) notFound();
  const s = store as StoreRow;

  const now = Date.now();
  const opensLater = s.opens_at ? new Date(s.opens_at).getTime() > now : false;
  const closed = s.closes_at ? new Date(s.closes_at).getTime() < now : false;
  const wholesale = s.type === "wholesale";
  const config = (s.config && typeof s.config === "object" && !Array.isArray(s.config) ? s.config : {}) as Record<string, unknown>;
  const tiers: Tier[] = Array.isArray(config.tiers)
    ? (config.tiers as unknown[]).flatMap((t) => (t && typeof t === "object" && "min" in t ? [{ min: Number((t as { min: unknown }).min) || 0, pct: Number((t as { pct?: unknown }).pct) || 0 }] : []))
    : [];
  const moq = Number(config.moq) || 0;
  const pct = Math.round(Number(s.fundraising_pct ?? 0) * (Number(s.fundraising_pct) <= 1 ? 100 : 1));

  let products: StoreProduct[] = [];
  if (!closed && !opensLater) {
    const { data } = await db().from("products").select("*, blank:blanks(*)").eq("store_id", s.id).order("created_at", { ascending: true });
    const rows = (data ?? []) as unknown as ProductWithBlank[];
    const paths = rows.flatMap((p) => (p.mockups ?? []).filter((m) => !m.startsWith("http")));
    const signed = await signedUrls(paths, 3600).catch(() => ({} as Record<string, string>));
    products = rows.map((p) => ({
      id: p.id,
      title: p.title ?? "Untitled",
      price: Number(p.price ?? 0),
      image: (p.mockups ?? []).map((m) => (m.startsWith("http") ? m : signed[m])).find(Boolean) ?? null,
      sizes: p.blank?.sizes?.length ? p.blank.sizes : ["S", "M", "L", "XL", "2XL"],
      blank: p.blank ? `${p.blank.brand ?? ""} ${p.blank.style ?? ""} ${p.blank.color ?? ""}`.trim() : null,
    }));
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-xs uppercase tracking-[.3em] text-mf-muted">{wholesale ? "Wholesale" : "Pop-up store"}</p>
      <h1 className="mt-1 text-4xl text-mf-gold">{s.name}</h1>
      {pct > 0 && <p className="mt-2 text-sm text-mf-cream"><span className="font-mono text-mf-gold">{pct}%</span> goes to the team.</p>}
      {s.closes_at && !closed && <p className="mt-1 text-xs text-mf-dim">Closes {fmtDate(s.closes_at)} PT — orders print together after that.</p>}

      {closed && (
        <div className="panel mt-8 p-8 text-center">
          <h2 className="text-2xl text-mf-cream">Store closed</h2>
          <p className="mt-2 text-sm text-mf-muted">This run closed {s.closes_at ? fmtDate(s.closes_at) : ""} PT and is on the press. Missed it? <Link href="/join">Get on the list</Link> for the next one.</p>
        </div>
      )}
      {!closed && opensLater && (
        <div className="panel mt-8 p-8 text-center">
          <h2 className="text-2xl text-mf-cream">Opens on {fmtDate(s.opens_at!)} PT</h2>
          <p className="mt-2 text-sm text-mf-muted">Come back then. <Link href="/join">Get a heads-up</Link> when the doors open.</p>
        </div>
      )}

      {!closed && !opensLater && (
        <>
          {wholesale && (
            <div className="panel mt-6 grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-mf-muted">Tier pricing{moq ? ` · MOQ ${moq}` : ""}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tiers.length ? tiers.map((t) => (
                    <span key={t.min} className="border border-mf-line px-2 py-1 font-mono text-xs text-mf-cream">{t.min}+ → {Math.round(t.pct * 100)}% off</span>
                  )) : <span className="text-xs text-mf-dim">Ask for the sheet.</span>}
                </div>
              </div>
              <Link href="/join?source=wholesale" className="btn">Reorder last</Link>
            </div>
          )}
          <StoreFront slug={s.slug ?? storeSlug} products={products} wholesale={wholesale} tiers={tiers} moq={moq} />
        </>
      )}
    </section>
  );
}
