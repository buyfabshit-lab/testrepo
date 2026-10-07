import { z } from "zod";
import { NextResponse } from "next/server";
import { bad, clientIp, parse, route } from "@/lib/api";
import { OFFICE_COOKIE, checkLock, issueOfficeToken, pinMatches, recordAttempt, MAX_FAILURES, LOCK_MINUTES } from "@/lib/auth/pin";
import { env } from "@/lib/env";
import { logEvent } from "@/lib/orders/service";
export const dynamic = "force-dynamic";
const Body = z.object({ pin: z.string().regex(/^\d{4,8}$/) });

/** Business Office PIN wall. Server-side check, HMAC cookie, lockout after 3 (spec §9). */
export const POST = route(async (req) => {
  const key = `pin:${clientIp(req)}`;
  const lock = await checkLock(key);
  if (lock.locked) return bad("locked out", 423, { until: lock.until, minutes: LOCK_MINUTES });
  if (!env.officePinHash() || !env.appSigningSecret()) return bad("office PIN not configured (OFFICE_PIN_HASH / APP_SIGNING_SECRET)", 503);
  const b = await parse(req, Body);
  const ok = pinMatches(b.pin);
  await recordAttempt(key, ok);
  if (!ok) {
    await logEvent({ actor: "system", kind: "office_pin", msg: `Bad office PIN from ${clientIp(req)}` });
    return bad("wrong PIN", 401, { max_failures: MAX_FAILURES });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OFFICE_COOKIE, issueOfficeToken(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 3600 });
  return res;
});
