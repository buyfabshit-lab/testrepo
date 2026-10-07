import { z } from "zod";
import { bad, clientIp, json, parse, rateLimit, route } from "@/lib/api";
import { db } from "@/lib/supabase/service";
import { CONSENT_TEXT, normalizePhone } from "@/lib/sms";
import { logEvent } from "@/lib/orders/service";
export const dynamic = "force-dynamic";
const Body = z.object({ phone: z.string().min(7), email: z.string().email().optional(), consent: z.literal(true), consent_text: z.string().max(600).optional(), source: z.string().max(40).default("opt_in_link") });

/** Explicit SMS consent capture (proof page, email opt-in link for the 1,418 list). */
export const POST = route(async (req) => {
  const ip = clientIp(req);
  if (!rateLimit(`optin:${ip}`, 10, 60_000)) return bad("slow down", 429);
  const b = await parse(req, Body);
  const phone = normalizePhone(b.phone);
  const consent = { phone, sms_consent_at: new Date().toISOString(), sms_consent_text: b.consent_text ?? CONSENT_TEXT, sms_consent_source: b.source, sms_consent_ip: ip, sms_opted_out_at: null };
  const match = b.email ? db().from("customers").select("id").ilike("email", b.email).maybeSingle() : db().from("customers").select("id").eq("phone", phone).maybeSingle();
  const { data: c } = await match;
  const res = c ? await db().from("customers").update(consent).eq("id", c.id).select("id").single() : await db().from("customers").insert({ ...consent, email: b.email?.toLowerCase() ?? null, source: b.source }).select("id").single();
  if (res.error) return bad(res.error.message, 500);
  await logEvent({ actor: "customer", kind: "sms_consent", msg: `SMS consent recorded via ${b.source}`, data: { customer_id: res.data.id } });
  return json({ ok: true, customer_id: res.data.id });
});
