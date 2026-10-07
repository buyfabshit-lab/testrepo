import { z } from "zod";
import { bad, clientIp, json, parse, rateLimit, route } from "@/lib/api";
import { db } from "@/lib/supabase/service";
import { screen } from "@/lib/screen";
import { CONSENT_TEXT, normalizePhone } from "@/lib/sms";
import { logEvent } from "@/lib/orders/service";
import { postToN8n } from "@/lib/n8n/sign";

export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(32).optional().nullable(),
  company: z.string().trim().max(160).optional().nullable(),
  niche: z.enum(["moto", "surf", "skate", "bar", "gym", "team", "band", "other"]).optional().nullable(),
  website: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  source: z.enum(["front_gate", "arcade", "checkout", "live", "wholesale", "outlaw", "import", "proof", "drive_in", "tiktok_live"]).default("front_gate"),
  email_opt_in: z.boolean().optional().default(false),
  sms_consent: z.boolean().optional().default(false),
  consent_text: z.string().max(600).optional().nullable(),
  brand_affinity: z.array(z.string().max(40)).max(10).optional(),
});

/** Lead + consent capture (spec §8). Anon → service role. Never direct table access. */
export const POST = route(async (req) => {
  const ip = clientIp(req);
  if (!rateLimit(`capture:${ip}`, 10, 60_000)) return bad("slow down", 429);
  const b = await parse(req, Body);

  const result = screen({ name: b.name, email: b.email, company: b.company, notes: b.notes, website: b.website });
  const phone = b.phone ? normalizePhone(b.phone) : null;
  const now = new Date().toISOString();

  // SMS consent is only recorded when the separate checkbox was ticked AND we have the exact text.
  const consent = b.sms_consent && phone
    ? { sms_consent_at: now, sms_consent_text: b.consent_text ?? CONSENT_TEXT, sms_consent_source: b.source, sms_consent_ip: ip }
    : {};

  const { data: existing } = await db().from("customers").select("id, sms_consent_at").ilike("email", b.email).maybeSingle();
  const row = {
    name: b.name, email: b.email.toLowerCase(), phone, company: b.company ?? null, niche: b.niche ?? null,
    source: existing ? undefined : b.source, email_opt_in: b.email_opt_in || undefined,
    brand_affinity: b.brand_affinity, screened_at: now, screen_result: result.result, ...consent,
  };
  const saved = existing
    ? await db().from("customers").update(row).eq("id", existing.id).select("id").single()
    : await db().from("customers").insert({ ...row, source: b.source }).select("id").single();
  if (saved.error) return bad(saved.error.message, 500);
  const customerId = saved.data.id;

  await logEvent({ actor: "system", kind: "lead", msg: `Lead ${b.email} via ${b.source} → ${result.result}`, data: { customer_id: customerId, hits: result.hits, website: b.website ?? null } });
  void postToN8n("pressline/lead", { customer_id: customerId, email: b.email, name: b.name, niche: b.niche ?? null, website: b.website ?? null, source: b.source, screen: result.result, email_opt_in: b.email_opt_in, sms_consent: Boolean(b.sms_consent && phone) });
  // A hit never rejects; it only tells Justin.
  return json({ customer_id: customerId, screen: result.result });
});
