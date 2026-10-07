import "server-only";
import { env } from "@/lib/env";
import { db } from "@/lib/supabase/service";

/**
 * SMS (spec §8). Three gates, all must pass:
 *   1. SMS_ENABLED=true (A2P 10DLC approved)
 *   2. LIVE_MONEY=true is NOT required, but outbound SMS is still an explicit action
 *   3. the customer has sms_consent_at set and sms_opted_out_at null
 * No checkbox = no texts, ever.
 */
export const CONSENT_TEXT =
  "I agree to receive recurring marketing texts from Midnight Fusion at this number. Msg & data rates may apply. " +
  "Msg frequency varies. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase.";

export const HELP_REPLY = "Midnight Fusion: custom print shop. Reply STOP to opt out. Questions: text here or email orders@midnightfusion.co.";
export const STOP_REPLY = "You're opted out of Midnight Fusion texts. You won't get more. Reply START to opt back in.";

export async function canText(customerId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!env.smsEnabled()) return { ok: false, reason: "SMS_ENABLED=false" };
  const { data } = await db().from("customers").select("phone, sms_consent_at, sms_opted_out_at").eq("id", customerId).maybeSingle();
  if (!data?.phone) return { ok: false, reason: "no phone" };
  if (!data.sms_consent_at) return { ok: false, reason: "no consent" };
  if (data.sms_opted_out_at) return { ok: false, reason: "opted out" };
  return { ok: true };
}

export async function sendSms(customerId: string, body: string): Promise<{ sent: boolean; reason?: string; sid?: string }> {
  const gate = await canText(customerId);
  if (!gate.ok) return { sent: false, reason: gate.reason };
  const { data } = await db().from("customers").select("phone").eq("id", customerId).maybeSingle();
  if (!data?.phone) return { sent: false, reason: "no phone" };
  const sid = env.twilioAccountSid(), token = env.twilioAuthToken(), svc = env.twilioMessagingServiceSid();
  if (!sid || !token || !svc) return { sent: false, reason: "twilio not configured" };
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: data.phone, MessagingServiceSid: svc, Body: body }),
  });
  const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!res.ok) return { sent: false, reason: json.message ?? `twilio ${res.status}` };
  return { sent: true, sid: json.sid };
}

/** Inbound keyword handling (Twilio webhook). Opt-out is permanent until START. */
export async function handleInboundKeyword(fromPhone: string, body: string): Promise<string | null> {
  const word = body.trim().toUpperCase();
  const phone = normalizePhone(fromPhone);
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(word)) {
    await db().from("customers").update({ sms_opted_out_at: new Date().toISOString() }).eq("phone", phone);
    return STOP_REPLY;
  }
  if (word === "HELP" || word === "INFO") return HELP_REPLY;
  if (word === "START" || word === "UNSTOP" || word === "YES") {
    await db().from("customers").update({ sms_opted_out_at: null }).eq("phone", phone);
    return "You're back on Midnight Fusion texts. Reply STOP any time.";
  }
  return null;
}

export function normalizePhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return p.startsWith("+") ? p : `+${digits}`;
}
