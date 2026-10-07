import { NextResponse } from "next/server";
import { z } from "zod";
import { bad, json, route } from "@/lib/api";
import { readSigned } from "@/lib/n8n/guard";
import { db } from "@/lib/supabase/service";
import { mintToken } from "@/lib/shopify";
import { fetchAndRefresh } from "@/lib/sanmar";
import { logEvent } from "@/lib/orders/service";
import { say } from "@/lib/outlaw";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Touch = z.object({ kind: z.literal("touch"), customer_id: z.string().uuid(), campaign: z.string().optional(), campaign_id: z.string().uuid().optional().nullable(), channel: z.enum(["email", "sms"]), payload: z.unknown().optional(), replied: z.boolean().optional(), converted_order_id: z.string().uuid().optional().nullable() });
const Generic = z.object({ kind: z.string() }).passthrough();

/** Generic inbound from n8n (HMAC). kinds: touch | shopify_refresh | sanmar_refresh | outlaw_say */
export const POST = route(async (req) => {
  const body = await readSigned<unknown>(req);
  if (body instanceof NextResponse) return body;
  const g = Generic.parse(body);
  switch (g.kind) {
    case "touch": {
      const t = Touch.parse(body);
      const { error } = await db().from("touches").insert({ customer_id: t.customer_id, campaign_id: t.campaign_id ?? null, channel: t.channel, payload: (t.payload ?? { campaign: t.campaign }) as never, sent_at: new Date().toISOString(), replied_at: t.replied ? new Date().toISOString() : null, converted_order_id: t.converted_order_id ?? null });
      if (error) return bad(error.message, 500);
      return json({ ok: true });
    }
    case "shopify_refresh": {
      const r = await mintToken();
      await logEvent({ actor: "n8n", kind: "shopify_token", msg: `Shopify token refreshed; expires ${r.expiresAt.toISOString()}` });
      return json({ ok: true, expires_at: r.expiresAt });
    }
    case "sanmar_refresh": return json({ ok: true, ...(await fetchAndRefresh()) });
    case "customer_tag": {
      const t = z.object({ customer_id: z.string().uuid(), niche: z.string().max(20).optional(), brand_affinity: z.array(z.string().max(40)).max(10).optional(), vip: z.boolean().optional() }).parse(body);
      const patch: { niche?: string; brand_affinity?: string[]; vip?: boolean } = {};
      if (t.niche) patch.niche = t.niche;
      if (t.brand_affinity) patch.brand_affinity = t.brand_affinity;
      if (typeof t.vip === "boolean") patch.vip = t.vip;
      const { error } = await db().from("customers").update(patch).eq("id", t.customer_id);
      return error ? bad(error.message, 500) : json({ ok: true });
    }
    case "campaign_send": {
      const t = z.object({ name: z.string().max(120), channel: z.enum(["email", "sms"]), workflow: z.string().max(80), status: z.string().max(20).default("sent"), audience_filter: z.unknown().optional() }).parse(body);
      const { data: existing } = await db().from("campaigns").select("id").eq("workflow", t.workflow).eq("name", t.name).maybeSingle();
      if (existing) { await db().from("campaigns").update({ status: t.status }).eq("id", existing.id); return json({ ok: true, campaign_id: existing.id }); }
      const { data, error } = await db().from("campaigns").insert({ name: t.name, channel: t.channel, workflow: t.workflow, status: t.status, audience_filter: (t.audience_filter ?? null) as never }).select("id").single();
      return error ? bad(error.message, 500) : json({ ok: true, campaign_id: data.id });
    }
    case "social_queue": {
      const t = z.object({ product_id: z.string().uuid().optional(), title: z.string().max(200), caption: z.string().max(2000), media: z.array(z.string()).max(10).default([]) }).parse(body);
      await logEvent({ actor: "n8n", kind: "social_queue", msg: `Queued drop post: ${t.title}`, data: t });
      return json({ ok: true });
    }
    case "referral_code": {
      const t = z.object({ customer_id: z.string().uuid() }).parse(body);
      const { data: c } = await db().from("customers").select("name").eq("id", t.customer_id).maybeSingle();
      const code = `MF-${(c?.name ?? "CREW").replace(/[^A-Za-z]/g, "").slice(0, 6).toUpperCase() || "CREW"}-${t.customer_id.slice(0, 4).toUpperCase()}`;
      await logEvent({ actor: "n8n", kind: "referral", msg: `Referral code ${code}`, data: { customer_id: t.customer_id, code } });
      return json({ ok: true, code });
    }
    case "wholesale_prospects": {
      const { data } = await db().from("customers").select("id, name, email, company, niche, vip").in("source", ["wholesale", "front_gate", "import"]).not("email", "is", null).is("sms_opted_out_at", null).limit(500);
      return json({ prospects: (data ?? []).filter((c) => c.company) });
    }
    case "outlaw_say": {
      const text = String((g as { text?: unknown }).text ?? "").slice(0, 500);
      if (!text) return bad("text required", 422);
      await say(null, text, { via: "n8n" });
      return json({ ok: true });
    }
    default: return bad(`unknown kind ${g.kind}`, 422);
  }
});
