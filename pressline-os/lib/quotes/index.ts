import "server-only";
import { z } from "zod";
import { db } from "@/lib/supabase/service";
import { priceQuote, sumSizes, type PriceRule } from "@/lib/pricing";

export const LineSchema = z.object({
  blank_id: z.string().uuid().optional().nullable(),
  blank_cost: z.number().nonnegative().optional(),
  blank_style: z.string().max(40).optional().nullable(),
  blank_brand: z.string().max(60).optional().nullable(),
  blank_color: z.string().max(60).optional().nullable(),
  method: z.enum(["screen", "dtf", "emb", "uv"]),
  sizes: z.record(z.string(), z.number().int().nonnegative()).default({}),
  qty: z.number().int().positive().optional(),
  locations: z.array(z.string()).min(1).default(["front"]),
  colors: z.number().int().nonnegative().default(1),
  design_id: z.string().uuid().optional().nullable(),
  label: z.string().max(200).optional(),
});

/** A live S&S pick has no blanks row yet: cache it (supplier ss) so order_lines keep a real FK. */
async function cacheBlank(l: z.infer<typeof LineSchema>): Promise<string | null> {
  if (l.blank_id || !l.blank_style || !l.blank_color) return l.blank_id ?? null;
  const { data: hit } = await db().from("blanks").select("id").eq("supplier", "ss").eq("style", l.blank_style).ilike("color", l.blank_color).maybeSingle();
  if (hit) return hit.id;
  const { data: created } = await db().from("blanks").insert({ supplier: "ss", style: l.blank_style, brand: l.blank_brand ?? null, color: l.blank_color, cost: l.blank_cost ?? null, updated_at: new Date().toISOString() }).select("id").single();
  return created?.id ?? null;
}

export async function priceLines(lines: z.infer<typeof LineSchema>[], rush: boolean) {
  for (const l of lines) l.blank_id = await cacheBlank(l);
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

