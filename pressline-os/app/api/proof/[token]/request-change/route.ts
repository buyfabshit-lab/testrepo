import { z } from "zod";
import { bad, json, params, parse, route } from "@/lib/api";
import { getOrderByProofToken, logEvent } from "@/lib/orders/service";
import { say } from "@/lib/outlaw";
import { sendEmail, layout } from "@/lib/email";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ token: string }> };
const Body = z.object({ comment: z.string().trim().min(1).max(2000) });

export const POST = route<Ctx>(async (req, ctx) => {
  const { token } = await params(ctx);
  const order = await getOrderByProofToken(token);
  if (!order) return bad("not found", 404);
  const b = await parse(req, Body);
  await logEvent({ orderId: order.id, actor: "customer", kind: "change_request", msg: `Change requested: ${b.comment.slice(0, 200)}`, data: { comment: b.comment } });
  await say(order.id, `→ justin: ${order.number} wants a change. Their words are in the log.`, { to: "justin" });
  if (env.justinEmail()) {
    await sendEmail({ to: env.justinEmail(), subject: `#${order.number} — change requested`, html: layout(`#${order.number} change request`, `<p>${b.comment.replace(/</g, "&lt;")}</p><p><a href="${env.appUrl()}/app/orders/${order.id}">Open order</a></p>`) }).catch(() => null);
  }
  return json({ ok: true });
});
