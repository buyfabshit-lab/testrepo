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
    case "outlaw_say": {
      const text = String((g as { text?: unknown }).text ?? "").slice(0, 500);
      if (!text) return bad("text required", 422);
      await say(null, text, { via: "n8n" });
      return json({ ok: true });
    }
    default: return bad(`unknown kind ${g.kind}`, 422);
  }
});
