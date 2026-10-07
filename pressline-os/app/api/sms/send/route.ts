import { NextResponse } from "next/server";
import { z } from "zod";
import { bad, json, route } from "@/lib/api";
import { currentStaff } from "@/lib/auth/staff";
import { SIGNATURE_HEADER, verify } from "@/lib/n8n/sign";
import { sendSms } from "@/lib/sms";
import { db } from "@/lib/supabase/service";
import { logEvent } from "@/lib/orders/service";
export const dynamic = "force-dynamic";
const Body = z.object({ customer_id: z.string().uuid(), body: z.string().trim().min(1).max(320), campaign_id: z.string().uuid().optional().nullable() });

/** The ONLY way a text leaves the building. Staff or n8n-signed. All consent gates live in lib/sms. */
export const POST = route(async (req) => {
  const raw = await req.text();
  const signed = verify(raw, req.headers.get(SIGNATURE_HEADER));
  const staff = signed ? null : await currentStaff();
  if (!signed && !staff) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = Body.parse(JSON.parse(raw || "{}"));
  const r = await sendSms(b.customer_id, b.body);
  if (!r.sent) return bad(`not sent: ${r.reason}`, 409, { reason: r.reason });
  await db().from("touches").insert({ customer_id: b.customer_id, campaign_id: b.campaign_id ?? null, channel: "sms", payload: { body: b.body, sid: r.sid } as never, sent_at: new Date().toISOString() });
  await logEvent({ actor: signed ? "n8n" : (staff?.name ?? "staff"), kind: "sms", msg: `SMS sent to customer ${b.customer_id.slice(0, 8)}`, data: { sid: r.sid } });
  return json({ sent: true, sid: r.sid });
});
