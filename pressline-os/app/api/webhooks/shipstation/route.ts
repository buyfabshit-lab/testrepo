import { timingSafeEqual } from "node:crypto";
import { bad, json, route } from "@/lib/api";
import { env } from "@/lib/env";
import { db } from "@/lib/supabase/service";
import { logEvent, transition } from "@/lib/orders/service";
export const dynamic = "force-dynamic";

/** ShipStation webhook (SHIP_NOTIFY / tracking). Shared-secret query `?key=<APP_SIGNING_SECRET>` since ShipStation doesn't sign. */
export const POST = route(async (req) => {
  const key = new URL(req.url).searchParams.get("key") ?? "";
  const want = env.appSigningSecret();
  if (!want || key.length !== want.length || !timingSafeEqual(Buffer.from(key), Buffer.from(want))) return bad("unauthorized", 401);
  const body = (await req.json().catch(() => ({}))) as { resource_type?: string; resource_url?: string; tracking_number?: string; delivered?: boolean };
  if (body.tracking_number) {
    const { data: s } = await db().from("shipments").select("id, order_id").eq("tracking", body.tracking_number).maybeSingle();
    if (s && body.delivered) {
      await db().from("shipments").update({ delivered_at: new Date().toISOString() }).eq("id", s.id);
      await logEvent({ orderId: s.order_id, actor: "system", kind: "delivered", msg: `Delivered (${body.tracking_number})` });
      if (s.order_id) await transition(s.order_id, "DONE", { actor: "system", reason: "delivered" }).catch(() => null);
    }
  }
  return json({ received: true, resource_type: body.resource_type ?? null });
});
