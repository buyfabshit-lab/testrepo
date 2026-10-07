import "server-only";
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { db } from "@/lib/supabase/service";

/**
 * Business Office PIN wall (spec §9). PIN checked server-side.
 * OFFICE_PIN_HASH format: scrypt$<salt hex>$<hash hex>   (make one with `npm run pin:hash -- 1234`)
 * Lockout after 3 failures for 15 minutes, keyed by client IP.
 */
export const MAX_FAILURES = 3;
export const LOCK_MINUTES = 15;
const TOKEN_TTL_SEC = 8 * 3600;

export function hashPin(pin: string, salt = Buffer.from(scryptSalt()).toString("hex")): string {
  const h = scryptSync(pin, Buffer.from(salt, "hex"), 32).toString("hex");
  return `scrypt$${salt}$${h}`;
}
function scryptSalt() {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
}

export function pinMatches(pin: string, stored = env.officePinHash()): boolean {
  const [algo, salt, h] = stored.split("$");
  if (algo !== "scrypt" || !salt || !h) return false;
  const calc = scryptSync(pin, Buffer.from(salt, "hex"), 32);
  const want = Buffer.from(h, "hex");
  return calc.length === want.length && timingSafeEqual(calc, want);
}

export async function checkLock(key: string): Promise<{ locked: boolean; until?: string }> {
  const { data } = await db().from("pin_attempts").select("failures, locked_until").eq("key", key).maybeSingle();
  if (data?.locked_until && new Date(data.locked_until) > new Date()) return { locked: true, until: data.locked_until };
  return { locked: false };
}

export async function recordAttempt(key: string, ok: boolean): Promise<void> {
  if (ok) {
    await db().from("pin_attempts").upsert({ key, failures: 0, locked_until: null, updated_at: new Date().toISOString() });
    return;
  }
  const { data } = await db().from("pin_attempts").select("failures").eq("key", key).maybeSingle();
  const failures = (data?.failures ?? 0) + 1;
  const locked_until = failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
  await db().from("pin_attempts").upsert({ key, failures: locked_until ? 0 : failures, locked_until, updated_at: new Date().toISOString() });
}

/** HMAC office token: `${exp}.${sig}` — set as an httpOnly cookie. */
export function issueOfficeToken(now = Math.floor(Date.now() / 1000)): string {
  const exp = now + TOKEN_TTL_SEC;
  const sig = createHmac("sha256", env.appSigningSecret()).update(`office.${exp}`).digest("hex");
  return `${exp}.${sig}`;
}

export function verifyOfficeToken(token: string | undefined | null, now = Math.floor(Date.now() / 1000)): boolean {
  if (!token || !env.appSigningSecret()) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now || !/^[0-9a-f]{64}$/.test(sig ?? "")) return false;
  const want = createHmac("sha256", env.appSigningSecret()).update(`office.${exp}`).digest("hex");
  const a = Buffer.from(want, "hex"), b = Buffer.from(sig ?? "", "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const OFFICE_COOKIE = "pl_office";
