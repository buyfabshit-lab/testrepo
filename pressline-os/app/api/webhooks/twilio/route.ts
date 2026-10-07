import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { handleInboundKeyword } from "@/lib/sms";
import { logEvent } from "@/lib/orders/service";
export const dynamic = "force-dynamic";

function twiml(message: string | null) {
  const body = message ? `<Message>${message.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Message>` : "";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, { headers: { "content-type": "text/xml" } });
}

/** Inbound SMS. STOP/HELP/START auto-handled; opt-out permanent (spec §8). Twilio signature verified. */
export async function POST(req: Request) {
  const raw = await req.text();
  const params = new URLSearchParams(raw);
  const url = env.appUrl().replace(/\/+$/, "") + "/api/webhooks/twilio";
  const sorted = Array.from(params.keys()).sort().map((k) => k + params.get(k)).join("");
  const want = createHmac("sha1", env.twilioAuthToken()).update(url + sorted).digest("base64");
  const given = req.headers.get("x-twilio-signature") ?? "";
  if (!env.twilioAuthToken() || want.length !== given.length || !timingSafeEqual(Buffer.from(want), Buffer.from(given))) {
    return new Response("bad signature", { status: 401 });
  }
  const from = params.get("From") ?? "", body = params.get("Body") ?? "";
  const reply = await handleInboundKeyword(from, body);
  await logEvent({ actor: "customer", kind: "sms_in", msg: `Inbound SMS ${reply ? "(keyword handled)" : ""}`, data: { from_last4: from.slice(-4), keyword: reply ? body.trim().toUpperCase() : null } });
  return twiml(reply);
}
