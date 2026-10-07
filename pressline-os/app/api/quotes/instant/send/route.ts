import { z } from "zod";
import { bad, clientIp, json, parse, rateLimit, route } from "@/lib/api";
import { db } from "@/lib/supabase/service";
import { priceQuote, type PriceRule } from "@/lib/pricing";
import { layout, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { logEvent } from "@/lib/orders/service";
import { postToN8n } from "@/lib/n8n/sign";
export const dynamic = "force-dynamic";
const Body = z.object({
  email: z.string().email(), design_id: z.string().uuid().optional().nullable(), qty: z.number().int().min(1).max(5000).default(12),
  blank_style: z.string().max(40).optional().nullable(), blank_color: z.string().max(60).optional().nullable(),
  method: z.enum(["screen", "dtf", "emb", "uv"]).default("dtf"), locations: z.number().int().min(1).max(4).default(1), colors: z.number().int().min(0).max(12).default(1),
});

/** "Send me this quote": saves a draft quote on the customer + emails it; Justin sees it in /app/quotes. */
export const POST = route(async (req) => {
  if (!rateLimit(`instant-send:${clientIp(req)}`, 10, 60_000)) return bad("slow down", 429);
  const b = await parse(req, Body);
  const email = b.email.toLowerCase();
  const { data: c } = await db().from("customers").select("id, name").ilike("email", email).maybeSingle();
  const customerId = c?.id ?? (await db().from("customers").insert({ email, source: "arcade" }).select("id").single()).data?.id;
  if (!customerId) return bad("could not save customer", 500);
  const { data: rules } = await db().from("price_rules").select("*");
  const { data: blank } = b.blank_style ? await db().from("blanks").select("id, cost").eq("style", b.blank_style).limit(1).maybeSingle() : { data: null };
  const priced = priceQuote([{ method: b.method, qty: b.qty, blankCost: Number(blank?.cost ?? 0), locations: b.locations, colors: b.colors }], (rules ?? []) as PriceRule[]);
  const line = priced.lines[0];
  const lines = [{ blank_id: blank?.id ?? null, method: b.method, qty: b.qty, sizes: {}, locations: Array.from({ length: b.locations }, (_, i) => (i === 0 ? "front" : "back")), colors: b.colors, design_id: b.design_id ?? null, unit: line.unit, setup: line.setup, line: line.line, label: `${b.qty} × ${b.blank_style ?? "tee"} ${b.blank_color ?? ""}`.trim() }];
  const { data: quote, error } = await db().from("quotes").insert({ customer_id: customerId, lines: lines as never, subtotal: priced.subtotal, total: priced.total, status: "draft" }).select("id").single();
  if (error) return bad(error.message, 500);
  await logEvent({ actor: "customer", kind: "quote", msg: `Instant quote requested from the studio — $${priced.total.toFixed(2)} for ${b.qty}`, data: { quote_id: quote.id, customer_id: customerId, design_id: b.design_id ?? null } });
  await sendEmail({
    to: email, subject: `Your Midnight Fusion quote — $${priced.total.toFixed(2)} for ${b.qty}`,
    html: layout("Here's your number", `<p>${b.qty} × ${b.blank_style ?? "tee"} ${b.blank_color ?? ""}, ${b.method.toUpperCase()}: <strong>$${line.unit.toFixed(2)} each</strong>${line.setup ? ` + $${line.setup.toFixed(2)} setup` : ""} = <strong>$${priced.total.toFixed(2)}</strong>.</p><p>Reply to this email and we lock it in. Your design is saved in the studio at <a href="${env.appUrl()}/design">${env.appUrl()}/design</a>.</p>`),
  }).catch(() => null);
  void postToN8n("pressline/upload", { quote_id: quote.id, customer_id: customerId, email, design_id: b.design_id ?? null, total: priced.total, qty: b.qty });
  return json({ ok: true, quote_id: quote.id, total: priced.total, unit: line.unit });
});
