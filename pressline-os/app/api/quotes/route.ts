import { z } from "zod";
import { json, staffOrSignedRoute, staffRoute } from "@/lib/api";
import { db } from "@/lib/supabase/service";
import { priceQuote, sumSizes, type PriceRule } from "@/lib/pricing";
import { logEvent } from "@/lib/orders/service";

export const dynamic = "force-dynamic";

export const LineSchema = z.object({
  blank_id: z.string().uuid().optional().nullable(),
  blank_cost: z.number().nonnegative().optional(),
  method: z.enum(["screen", "dtf", "emb", "uv"]),
  sizes: z.record(z.string(), z.number().int().nonnegative()).default({}),
  qty: z.number().int().positive().optional(),
  locations: z.array(z.string()).min(1).default(["front"]),
  colors: z.number().int().nonnegative().default(1),
  design_id: z.string().uuid().optional().nullable(),
  label: z.string().max(200).optional(),
});
const Body = z.object({ customer_id: z.string().uuid(), lines: z.array(LineSchema).min(1), rush: z.boolean().default(false), dry_run: z.boolean().default(false) });

export async function priceLines(lines: z.infer<typeof LineSchema>[], rush: boolean) {
  const { data: rules } = await db().from("price_rules").select("*");
  const blankIds = lines.map((l) => l.blank_id).filter((x): x is string => Boolean(x));
  const { data: blanks } = blankIds.length ? await db().from("blanks").select("id, cost, style, brand, color").in("id", blankIds) : { data: [] as Array<{ id: string; cost: number | null; style: string | null; brand: string | null; color: string | null }> };
  const inputs = lines.map((l) => {
    const blank = blanks?.find((b) => b.id === l.blank_id);
    return { method: l.method, qty: l.qty ?? (sumSizes(l.sizes) || 1), blankCost: l.blank_cost ?? Number(blank?.cost ?? 0), locations: l.locations.length, colors: l.colors, rush };
  });
  const priced = priceQuote(inputs, (rules ?? []) as PriceRule[]);
  return {
    lines: lines.map((l, i) => ({ ...l, qty: priced.lines[i].qty, unit: priced.lines[i].unit, setup: priced.lines[i].setup, line: priced.lines[i].line, blank: blanks?.find((b) => b.id === l.blank_id) ?? null })),
    subtotal: priced.subtotal, total: priced.total,
  };
}

export const GET = staffRoute(undefined, async () => {
  const { data, error } = await db().from("quotes").select("*, customer:customers(id,name,company,email)").order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return json({ quotes: data });
});

export const POST = staffOrSignedRoute(undefined, async (_req, _ctx, staff, raw) => {
  const b = Body.parse(raw ?? {});
  const priced = await priceLines(b.lines, b.rush);
  if (b.dry_run) return json({ quote: { lines: priced.lines, subtotal: priced.subtotal, total: priced.total } });
  const { data, error } = await db().from("quotes").insert({ customer_id: b.customer_id, lines: priced.lines as never, subtotal: priced.subtotal, total: priced.total, status: "draft" }).select("*").single();
  if (error) throw new Error(error.message);
  await logEvent({ actor: staff.name ?? staff.role, kind: "quote", msg: `Quote ${data.id.slice(0, 8)} drafted — $${priced.total.toFixed(2)}`, data: { quote_id: data.id } });
  return json({ quote: data }, 201);
});
