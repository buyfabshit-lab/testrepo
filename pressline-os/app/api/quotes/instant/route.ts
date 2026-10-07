import { z } from "zod";
import { bad, clientIp, json, parse, rateLimit, route } from "@/lib/api";
import { db } from "@/lib/supabase/service";
import { priceQuote, type PriceRule } from "@/lib/pricing";

export const dynamic = "force-dynamic";
const Body = z.object({
  design_id: z.string().uuid().optional().nullable(),
  qty: z.number().int().min(1).max(5000).default(12),
  blank_style: z.string().max(40).optional().nullable(),
  blank_color: z.string().max(60).optional().nullable(),
  method: z.enum(["screen", "dtf", "emb", "uv"]).default("dtf"),
  locations: z.number().int().min(1).max(4).default(1),
  colors: z.number().int().min(0).max(12).default(1),
});

/** "Make it real" — instant price from the studio (no auth; rate-limited). */
export const POST = route(async (req) => {
  if (!rateLimit(`instant:${clientIp(req)}`, 30, 60_000)) return bad("slow down", 429);
  const b = await parse(req, Body);
  const { data: rules } = await db().from("price_rules").select("*");
  let blankCost = 0;
  if (b.blank_style) {
    const { data: blank } = await db().from("blanks").select("cost").eq("style", b.blank_style).limit(1).maybeSingle();
    blankCost = Number(blank?.cost ?? 0);
  }
  const priced = priceQuote([{ method: b.method, qty: b.qty, blankCost, locations: b.locations, colors: b.colors }], (rules ?? []) as PriceRule[]);
  const line = priced.lines[0];
  return json({ qty: b.qty, unit: line.unit, setup: line.setup, total: priced.total, method: b.method, rule_found: Boolean(line.rule) });
});
