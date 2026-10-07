import "server-only";
import { env } from "@/lib/env";
import { db } from "@/lib/supabase/service";

/**
 * SanMar EPDD import (spec §7.6): nightly refresh of flat photo URLs from the
 * EPDD data file (CSV, SANMAR_DATA_URL). Only the columns we use.
 */
export interface EpddRow { style: string; brand: string; color: string; size: string; price: number | null; front: string | null; back: string | null }

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const split = (line: string) => {
    const out: string[] = []; let cur = "", q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === "," && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = split(lines[0]).map((h) => h.toUpperCase().replace(/[^A-Z0-9]+/g, "_"));
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [headers[i] ?? `C${i}`, v])));
}

const pick = (r: Record<string, string>, ...keys: string[]) => keys.map((k) => r[k]).find((v) => v && v.length) ?? "";

export function toEpddRows(rows: Record<string, string>[]): EpddRow[] {
  return rows
    .map((r) => ({
      style: pick(r, "STYLE", "STYLE_NUMBER", "STYLE_", "UNIQUE_KEY"),
      brand: pick(r, "BRAND", "BRAND_NAME", "MILL"),
      color: pick(r, "COLOR_NAME", "COLOR", "CATALOG_COLOR"),
      size: pick(r, "SIZE", "SIZE_NAME"),
      price: Number(pick(r, "PIECE_PRICE", "CASE_PRICE", "PRICE")) || null,
      front: pick(r, "FRONT_MODEL_IMAGE_URL", "FRONT_FLAT_IMAGE", "FRONT_IMAGE", "PRODUCT_IMAGE") || null,
      back: pick(r, "BACK_MODEL_IMAGE_URL", "BACK_FLAT_IMAGE", "BACK_IMAGE") || null,
    }))
    .filter((r) => r.style && r.color);
}

/** Group EPDD rows into blanks (style+color) with size lists and write them. */
export async function refreshFromEpdd(csvText: string): Promise<{ upserted: number }> {
  const rows = toEpddRows(parseCsv(csvText));
  const byKey = new Map<string, { style: string; brand: string; color: string; sizes: Set<string>; cost: number | null; front: string | null; back: string | null }>();
  for (const r of rows) {
    const k = `${r.style}|${r.color}`;
    const g = byKey.get(k) ?? { style: r.style, brand: r.brand, color: r.color, sizes: new Set<string>(), cost: r.price, front: r.front, back: r.back };
    if (r.size) g.sizes.add(r.size);
    g.cost = g.cost ?? r.price; g.front = g.front ?? r.front; g.back = g.back ?? r.back;
    byKey.set(k, g);
  }
  let upserted = 0;
  for (const g of byKey.values()) {
    const { data: existing } = await db().from("blanks").select("id").eq("supplier", "sanmar").eq("style", g.style).eq("color", g.color).maybeSingle();
    const row = { supplier: "sanmar" as const, style: g.style, brand: g.brand, color: g.color, sizes: Array.from(g.sizes), cost: g.cost, photo_front: g.front, photo_back: g.back, updated_at: new Date().toISOString() };
    const res = existing ? await db().from("blanks").update(row).eq("id", existing.id) : await db().from("blanks").insert(row);
    if (!res.error) upserted++;
  }
  return { upserted };
}

export async function fetchAndRefresh(): Promise<{ upserted: number }> {
  const url = env.sanmarDataUrl();
  if (!url) throw new Error("SANMAR_DATA_URL not set");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SanMar EPDD fetch → ${res.status}`);
  return refreshFromEpdd(await res.text());
}
