import "server-only";
import { db } from "@/lib/supabase/service";
import { BOARD_LANES, isOrderStatus, type OrderStatus } from "@/lib/orders/status";
import type { Json, StoreRow } from "@/lib/supabase/types";

/**
 * World reads. Every function here is a thin, public-safe view over the same
 * tables the dashboard uses. No costs, no tokens, no customer PII leave here.
 * Every read swallows errors into an empty result so a dead DB still renders rooms.
 */

export type LaneCounts = Partial<Record<OrderStatus, number>>;

export async function laneCounts(): Promise<LaneCounts> {
  try {
    const { data } = await db().from("orders").select("status").not("status", "in", "(DONE,CANCELLED)");
    const counts: LaneCounts = {};
    for (const row of data ?? []) {
      if (isOrderStatus(row.status)) counts[row.status] = (counts[row.status] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

export const LANES = BOARD_LANES;

export interface RunReport {
  id: string; run_date: string | null; report: string | null; sheets: number; designs: number;
  sent_to_danny_at: string | null; created_at: string | null;
}
export async function lastGangRun(): Promise<RunReport | null> {
  try {
    const { data } = await db().from("gang_runs")
      .select("id, run_date, report, sheet_files, design_ids, sent_to_danny_at, created_at")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!data) return null;
    return {
      id: data.id, run_date: data.run_date, report: data.report, created_at: data.created_at,
      sheets: data.sheet_files?.length ?? 0, designs: data.design_ids?.length ?? 0, sent_to_danny_at: data.sent_to_danny_at,
    };
  } catch {
    return null;
  }
}

export interface DockShipment {
  id: string; orderNumber: number | null; carrier: string | null; tracking: string | null;
  shipped_at: string | null; delivered_at: string | null;
}
export async function recentShipments(limit = 20): Promise<DockShipment[]> {
  try {
    const { data } = await db().from("shipments")
      .select("id, order_id, carrier, tracking, shipped_at, delivered_at")
      .order("shipped_at", { ascending: false, nullsFirst: false }).limit(limit);
    const rows = data ?? [];
    const orderIds = Array.from(new Set(rows.map((r) => r.order_id).filter((v): v is string => Boolean(v))));
    const numbers = new Map<string, number>();
    if (orderIds.length) {
      const { data: orders } = await db().from("orders").select("id, number").in("id", orderIds);
      for (const o of orders ?? []) numbers.set(o.id, o.number);
    }
    return rows.map((r) => ({
      id: r.id, orderNumber: r.order_id ? numbers.get(r.order_id) ?? null : null,
      carrier: r.carrier, tracking: r.tracking, shipped_at: r.shipped_at, delivered_at: r.delivered_at,
    }));
  } catch {
    return [];
  }
}

/** Public store view: name/slug/type/window only. `config` is reduced to wholesale terms. */
export interface PublicStore {
  id: string; name: string; slug: string; type: NonNullable<StoreRow["type"]>;
  opens_at: string | null; closes_at: string | null; fundraising_pct: number | null; world_room: string | null;
  moq: number | null; tiers: Array<{ min: number; pct: number }>;
}
function wholesaleTerms(config: Json | null): { moq: number | null; tiers: Array<{ min: number; pct: number }> } {
  if (!config || typeof config !== "object" || Array.isArray(config)) return { moq: null, tiers: [] };
  const c = config as { [k: string]: Json | undefined };
  const moq = typeof c.moq === "number" ? c.moq : null;
  const tiers = Array.isArray(c.tiers)
    ? c.tiers.flatMap((t) => {
        if (!t || typeof t !== "object" || Array.isArray(t)) return [];
        const tt = t as { [k: string]: Json | undefined };
        return typeof tt.min === "number" && typeof tt.pct === "number" ? [{ min: tt.min, pct: tt.pct }] : [];
      })
    : [];
  return { moq, tiers };
}
function isOpen(s: { closed_order_id: string | null; closes_at: string | null; opens_at: string | null }, now = Date.now()): boolean {
  if (s.closed_order_id) return false;
  if (s.closes_at && new Date(s.closes_at).getTime() < now) return false;
  if (s.opens_at && new Date(s.opens_at).getTime() > now) return false;
  return true;
}
function toPublic(s: StoreRow): PublicStore | null {
  if (!s.slug || !s.type) return null;
  return {
    id: s.id, name: s.name ?? s.slug, slug: s.slug, type: s.type, opens_at: s.opens_at, closes_at: s.closes_at,
    fundraising_pct: s.fundraising_pct, world_room: s.world_room, ...wholesaleTerms(s.config),
  };
}

export async function openStores(filter: { type?: StoreRow["type"]; slug?: string } = {}): Promise<PublicStore[]> {
  try {
    let q = db().from("stores").select("*").is("closed_order_id", null).order("created_at", { ascending: true });
    if (filter.type) q = q.eq("type", filter.type);
    if (filter.slug) q = q.eq("slug", filter.slug);
    const { data } = await q;
    return (data ?? []).filter((s) => isOpen(s)).map(toPublic).filter((s): s is PublicStore => Boolean(s));
  } catch {
    return [];
  }
}

export async function openStore(slug: string): Promise<PublicStore | null> {
  const [s] = await openStores({ slug });
  return s ?? null;
}

export interface PublicProduct { id: string; title: string; price: number | null; mockup: string | null; storeSlug: string; created_at: string | null }
function mockupUrl(m: string[] | null): string | null {
  const first = m?.find((u) => /^https?:\/\//.test(u));
  return first ?? null;
}
export async function productsFor(stores: PublicStore[], limit = 60): Promise<PublicProduct[]> {
  if (!stores.length) return [];
  try {
    const slugById = new Map(stores.map((s) => [s.id, s.slug]));
    const { data } = await db().from("products").select("id, title, price, mockups, store_id, created_at")
      .in("store_id", stores.map((s) => s.id)).order("created_at", { ascending: false }).limit(limit);
    return (data ?? []).flatMap((p) => {
      const slug = p.store_id ? slugById.get(p.store_id) : undefined;
      if (!slug) return [];
      return [{ id: p.id, title: p.title ?? "Untitled drop", price: p.price, mockup: mockupUrl(p.mockups), storeSlug: slug, created_at: p.created_at }];
    });
  } catch {
    return [];
  }
}

export interface OutlawEvent { id: number; msg: string; kind: string | null; ts: string | null; order_id: string | null }
export async function outlawEvents(limit = 20): Promise<OutlawEvent[]> {
  try {
    const { data } = await db().from("events").select("id, msg, kind, ts, order_id").eq("actor", "outlaw")
      .order("ts", { ascending: false }).limit(limit);
    return (data ?? []).flatMap((e) => (e.msg ? [{ id: e.id, msg: e.msg, kind: e.kind, ts: e.ts, order_id: e.order_id }] : []));
  } catch {
    return [];
  }
}

/** Blank counts per supplier for the District cards. */
export async function blankCounts(): Promise<Record<string, number>> {
  try {
    const { data } = await db().from("blanks").select("supplier");
    const out: Record<string, number> = {};
    for (const b of data ?? []) if (b.supplier) out[b.supplier] = (out[b.supplier] ?? 0) + 1;
    return out;
  } catch {
    return {};
  }
}

/** Office reads — only called after the PIN cookie verifies. Customer PII is left out on purpose. */
export interface OfficeQuote { id: string; total: number | null; lineCount: number; created_at: string | null }
export interface OfficePo { id: string; supplier: string | null; lineCount: number; created_at: string | null; orderNumber: number | null }
export async function officeDesk(): Promise<{ quotes: OfficeQuote[]; pos: OfficePo[] }> {
  try {
    const [{ data: quotes }, { data: pos }] = await Promise.all([
      db().from("quotes").select("id, total, lines, created_at").eq("status", "sent").order("created_at", { ascending: false }).limit(50),
      db().from("purchase_orders").select("id, supplier, lines, created_at, order_id").eq("status", "pending_approval").order("created_at", { ascending: false }).limit(50),
    ]);
    const orderIds = Array.from(new Set((pos ?? []).map((p) => p.order_id).filter((v): v is string => Boolean(v))));
    const numbers = new Map<string, number>();
    if (orderIds.length) {
      const { data: orders } = await db().from("orders").select("id, number").in("id", orderIds);
      for (const o of orders ?? []) numbers.set(o.id, o.number);
    }
    const count = (lines: Json | null) => (Array.isArray(lines) ? lines.length : 0);
    return {
      quotes: (quotes ?? []).map((q) => ({ id: q.id, total: q.total, lineCount: count(q.lines), created_at: q.created_at })),
      pos: (pos ?? []).map((p) => ({ id: p.id, supplier: p.supplier, lineCount: count(p.lines), created_at: p.created_at, orderNumber: p.order_id ? numbers.get(p.order_id) ?? null : null })),
    };
  } catch {
    return { quotes: [], pos: [] };
  }
}
