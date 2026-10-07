import { z } from "zod";
import { bad, json, parse, staffRoute } from "@/lib/api";
import { db } from "@/lib/supabase/service";
import { createLabel, shipstationConfigured, trackingUrl } from "@/lib/shipping";
import { putObject, signedUrl } from "@/lib/supabase/storage";
import { logEvent, transition } from "@/lib/orders/service";
import { say } from "@/lib/outlaw";
import { layout, sendEmail } from "@/lib/email";
import { actorFor } from "@/lib/auth/staff";
export const dynamic = "force-dynamic";
const Body = z.object({
  order_id: z.string().uuid(),
  ship_to: z.object({ name: z.string(), company: z.string().optional().nullable(), street1: z.string(), street2: z.string().optional().nullable(), city: z.string(), state: z.string(), postalCode: z.string(), phone: z.string().optional().nullable() }),
  weight_oz: z.number().positive().default(16),
  carrier: z.string().optional(), service: z.string().optional(),
});
export const POST = staffRoute(undefined, async (req, _ctx, staff) => {
  const b = await parse(req, Body);
  const { data: order } = await db().from("orders").select("id, number, status, customer_id, customer:customers(email, name, address)").eq("id", b.order_id).maybeSingle();
  if (!order) return bad("order not found", 404);
  if (!shipstationConfigured()) return bad("ShipStation not configured (SHIPSTATION_API_KEY/SECRET)", 503);
  const label = await createLabel({ orderNumber: order.number, shipTo: b.ship_to, weightOz: b.weight_oz, carrierCode: b.carrier, serviceCode: b.service });
  const path = `labels/${order.number}/${label.trackingNumber}.pdf`;
  await putObject(path, Buffer.from(label.labelData, "base64"), "application/pdf");
  const { data: shipment, error } = await db().from("shipments").insert({ order_id: order.id, carrier: label.carrierCode, tracking: label.trackingNumber, label_url: path, shipped_at: new Date().toISOString() }).select("*").single();
  if (error) throw new Error(error.message);
  if (order.customer_id && !order.customer?.address) await db().from("customers").update({ address: b.ship_to as never }).eq("id", order.customer_id);
  await logEvent({ orderId: order.id, actor: actorFor(staff), kind: "shipment", msg: `Label ${label.carrierCode} ${label.trackingNumber} ($${label.shipmentCost})`, data: { shipment_id: shipment.id } });
  if (order.status === "PACKED") await transition(order.id, "SHIPPED", { actor: actorFor(staff), reason: `label ${label.trackingNumber}` });
  await say(order.id, `Packed under Outlaw's watch — #${order.number}. Tracking ${label.trackingNumber}.`, { tracking: label.trackingNumber });
  const url = trackingUrl(label.carrierCode, label.trackingNumber);
  if (order.customer?.email) await sendEmail({ to: order.customer.email, subject: `Order #${order.number} shipped`, html: layout("It's on the way", `<p>Your Midnight Fusion order #${order.number} shipped.</p><p><a href="${url}">Track it →</a></p>`) }).catch(() => null);
  return json({ shipment, tracking_url: url, label_url: await signedUrl(path, 3600).catch(() => null) }, 201);
});
