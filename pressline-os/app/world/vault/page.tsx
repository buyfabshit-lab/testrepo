import RoomFrame from "@/components/world/RoomFrame";
import { search } from "@/lib/vault";

export const dynamic = "force-dynamic";

const LICENSE = { mcg: "MCG", customer: "Customer", camo: "Camo" } as const;

/** The Vault — graphics browser. Same query the GET /api/vault route runs, read server-side so the room is public-safe. */
export default async function VaultPage({ searchParams }: { searchParams: Promise<{ q?: string; brand?: string; license?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = 48;
  const q = sp.q?.trim() || undefined, brand = sp.brand?.trim() || undefined, license = sp.license?.trim() || undefined;
  const result = await search({ q, brand, license, limit, offset: (page - 1) * limit }).catch(() => ({ total: 0, assets: [] as never[] }));
  const assets = result.assets as Array<{ id: string; title: string | null; brand: string | null; tags: string[] | null; colors: number | null; license: string | null; thumb: string | null }>;
  const pages = Math.max(1, Math.ceil(result.total / limit));
  const qs = (p: number) => { const u = new URLSearchParams(); if (q) u.set("q", q); if (brand) u.set("brand", brand); if (license) u.set("license", license); u.set("page", String(p)); return `?${u}`; };

  return (
    <RoomFrame slug="vault" aside={<span className="text-mf-muted">{result.total} graphics</span>}>
      <form className="panel mb-5 grid gap-3 p-4 sm:grid-cols-[1fr_180px_160px_auto]" method="get">
        <input className="input" name="q" placeholder="Search titles" defaultValue={q ?? ""} aria-label="Search" />
        <input className="input" name="brand" placeholder="Brand" defaultValue={brand ?? ""} aria-label="Brand" />
        <select className="input" name="license" defaultValue={license ?? ""} aria-label="License">
          <option value="">Any license</option>
          {Object.entries(LICENSE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn btn-solid" type="submit">Open drawer</button>
      </form>
      {assets.length === 0 ? (
        <p className="panel px-4 py-10 text-center text-sm text-mf-muted">Drawer&rsquo;s empty for that search.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {assets.map((a) => (
            <li key={a.id} className="panel overflow-hidden">
              <div className="aspect-square bg-mf-bg">
                {a.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed storage URLs
                  <img src={a.thumb} alt={a.title ?? "Vault graphic"} className="h-full w-full object-contain" loading="lazy" />
                ) : <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-[.2em] text-mf-dim">no thumb</div>}
              </div>
              <div className="p-2">
                <p className="truncate text-sm text-mf-cream" title={a.title ?? undefined}>{a.title ?? "Untitled"}</p>
                <p className="mt-1 flex flex-wrap gap-1 text-[10px] uppercase tracking-[.1em] text-mf-dim">
                  {a.brand && <span>{a.brand}</span>}
                  {a.license && <span className="badge border border-mf-line text-mf-muted">{LICENSE[a.license as keyof typeof LICENSE] ?? a.license}</span>}
                  {typeof a.colors === "number" && <span>{a.colors}c</span>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav className="mt-5 flex items-center justify-center gap-4 text-xs uppercase tracking-[.14em]" aria-label="Pages">
          {page > 1 ? <a href={qs(page - 1)}>← Prev</a> : <span className="text-mf-dim">← Prev</span>}
          <span className="text-mf-muted">{page} / {pages}</span>
          {page < pages ? <a href={qs(page + 1)}>Next →</a> : <span className="text-mf-dim">Next →</span>}
        </nav>
      )}
    </RoomFrame>
  );
}
