/**
 * HMAC signing for every n8n <-> app call. Reject unsigned.
 *
 * Header:  X-Pressline-Signature: t=<unix seconds>,v1=<hex hmac-sha256>
 * Payload: `${t}.${rawBody}` signed with N8N_WEBHOOK_SECRET.
 * Replay window: 5 minutes.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export const SIGNATURE_HEADER = "x-pressline-signature";
const WINDOW_SEC = 300;

export function sign(rawBody: string, secret = env.n8nWebhookSecret(), now = Math.floor(Date.now() / 1000)): string {
  if (!secret) throw new Error("N8N_WEBHOOK_SECRET is not set");
  const mac = createHmac("sha256", secret).update(`${now}.${rawBody}`).digest("hex");
  return `t=${now},v1=${mac}`;
}

export function verify(rawBody: string, header: string | null, secret = env.n8nWebhookSecret(), now = Math.floor(Date.now() / 1000)): boolean {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = Number(parts.t);
  const v1 = parts.v1 ?? "";
  if (!Number.isFinite(t) || Math.abs(now - t) > WINDOW_SEC || !/^[0-9a-f]{64}$/.test(v1)) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** Post a signed event to an n8n webhook path (e.g. "pressline/status"). Never throws. */
export async function postToN8n(path: string, payload: unknown): Promise<{ ok: boolean; status?: number }> {
  const base = env.n8nBaseUrl().replace(/\/+$/, "");
  const body = JSON.stringify(payload);
  if (!env.n8nWebhookSecret()) {
    console.warn(`[n8n] secret not set; skipped ${path}`);
    return { ok: false };
  }
  try {
    const res = await fetch(`${base}/webhook/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", [SIGNATURE_HEADER]: sign(body) },
      body,
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.warn(`[n8n] ${path} unreachable:`, err instanceof Error ? err.message : err);
    return { ok: false };
  }
}
