"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/components/ui/api";
import { Button } from "@/components/ui/Button";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Thumb } from "@/components/ui/Thumb";

type Asset = { id: string; title: string | null; brand: string | null; tags: string[] | null; colors: number | null; dpi: number | null; license: string | null; thumb: string | null; storage_path: string };
const LICENSE_TONE: Record<string, Tone> = { mcg: "blood", customer: "gold", camo: "ok" };

export function VaultSearch() {
  const [q, setQ] = useState(""); const [brand, setBrand] = useState(""); const [tags, setTags] = useState(""); const [license, setLicense] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ total: number; assets: Asset[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true); setError(null);
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim()); if (brand.trim()) p.set("brand", brand.trim()); if (tags.trim()) p.set("tags", tags.trim()); if (license) p.set("license", license);
    try { setRes(await api(`/api/vault?${p.toString()}`)); }
    catch (err) { setError(err instanceof Error ? err.message : "Search failed"); }
    finally { setBusy(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  useEffect(() => { void search(); }, []);

  return (
    <>
      <form onSubmit={search} className="panel mb-4 grid grid-cols-2 gap-2 p-3 md:grid-cols-5">
        <input className="input col-span-2 md:col-span-1" placeholder="Title" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className="input" placeholder="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
        <input className="input" placeholder="tags, comma, separated" value={tags} onChange={(e) => setTags(e.target.value)} />
        <select className="input" value={license} onChange={(e) => setLicense(e.target.value)}>
          <option value="">Any license</option><option value="mcg">MCG</option><option value="customer">Customer</option><option value="camo">Camo</option>
        </select>
        <Button type="submit" variant="solid" loading={busy} className="justify-center">Search</Button>
      </form>
      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
      {res ? <p className="mb-2 text-xs uppercase tracking-widest text-mf-dim">{res.total} assets</p> : null}
      {res && res.assets.length === 0 ? <p className="panel p-8 text-center text-sm text-mf-dim">Nothing in the Vault matches.</p> : null}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {res?.assets.map((a) => (
          <li key={a.id} className="panel overflow-hidden">
            <div className="aspect-square bg-mf-bg">
              {a.thumb ? <Thumb src={a.thumb} alt={a.title ?? ""} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-xs text-mf-dim">no thumb</div>}
            </div>
            <div className="p-2">
              <p className="truncate text-sm font-bold" title={a.title ?? ""}>{a.title ?? a.storage_path.split("/").pop()}</p>
              <p className="truncate text-xs text-mf-muted">{a.brand ?? ""}{a.colors ? ` · ${a.colors}c` : ""}{a.dpi ? ` · ${a.dpi}dpi` : ""}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge tone={LICENSE_TONE[a.license ?? ""] ?? "muted"}>{a.license ?? "unlicensed"}</Badge>
                {(a.tags ?? []).slice(0, 2).map((t) => <Badge key={t}>{t}</Badge>)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
