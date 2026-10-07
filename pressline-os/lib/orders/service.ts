import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/supabase/service";
import { postToN8n } from "@/lib/n8n/sign";
import { audienceFor, canTransition, isOrderStatus, type OrderStatus } from "./status";

export type Actor = "outlaw" | "justin" | "jeff" | "danny" | "customer" | "n8n" | "system" | string;

/** Append an events row. Never throws (the log must not break the flow). */
export async function logEvent(input: {
  orderId?: string | null; actor: Actor; kind: string; msg: string; data?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await db().from("events").insert({
    order_id: input.orderId ?? null,
    actor: input.actor,
    kind: input.kind,
    msg: input.msg,
    data: (input.data ?? null) as never,
  });
  if (error) console.warn("[events] insert failed:", error.message);
}

export function newProofToken(): string {
  return randomBytes(18).toString("base64url");
}

export async function getOrder(id: string) {
  const { data, error } = await db()
    .from("orders")
    .select("*, customer:customers(*), lines:order_lines(*, blank:blanks(*), design:designs(*))")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getOrderByNumber(number: number) {
  const { data, error } = await db()
    .from("orders")
    .select("*, customer:customers(*), lines:order_lines(*, blank:blanks(*), design:designs(*))")
    .eq("number", number)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getOrderByProofToken(token: string) {
  const { data, error } = await db()
    .from("orders")
    .select("*, customer:customers(*), quote:quotes(*), lines:order_lines(*, blank:blanks(*), design:designs(*)), invoices(*)")
    .eq("proof_token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Move an order through the state machine. Writes the events row and posts
 * `pressline/status` to n8n on every transition (spec §6).
 */
export async function transition(
  orderId: string,
  to: OrderStatus,
  opts: { actor: Actor; reason?: string; force?: boolean; data?: Record<string, unknown> },
) {
  if (!isOrderStatus(to)) throw new Error(`Unknown status ${String(to)}`);
  const { data: current, error } = await db().from("orders").select("id, number, status, customer_id, due_date, rush").eq("id", orderId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!current) throw new Error("Order not found");
  const from = current.status as OrderStatus;
  if (from === to) return current;
  if (!canTransition(from, to, { force: opts.force })) {
    throw new Error(`Cannot move #${current.number} from ${from} to ${to}`);
  }
  const { data: updated, error: upErr } = await db().from("orders").update({ status: to }).eq("id", orderId).select("*").single();
  if (upErr) throw new Error(upErr.message);

  await logEvent({
    orderId,
    actor: opts.actor,
    kind: "status",
    msg: `#${current.number} ${from} → ${to}${opts.reason ? ` — ${opts.reason}` : ""}`,
    data: { from, to, reason: opts.reason ?? null, ...(opts.data ?? {}) },
  });

  void postToN8n("pressline/status", {
    order_id: orderId,
    number: current.number,
    customer_id: current.customer_id,
    from,
    to,
    actor: opts.actor,
    reason: opts.reason ?? null,
    audience: audienceFor(to),
    at: new Date().toISOString(),
  });

  return updated;
}

export async function listOrders(filter: { status?: OrderStatus; limit?: number } = {}) {
  let q = db()
    .from("orders")
    .select("*, customer:customers(id,name,company,email), lines:order_lines(id, sizes, locations, unit_price)")
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 200);
  if (filter.status) q = q.eq("status", filter.status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}
