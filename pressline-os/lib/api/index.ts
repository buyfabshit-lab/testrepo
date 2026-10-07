import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { AuthError, currentStaff, requireStaff, type StaffRole, type StaffSession } from "@/lib/auth/staff";
import { OFFICE_COOKIE, verifyOfficeToken } from "@/lib/auth/pin";
import { SIGNATURE_HEADER, verify } from "@/lib/n8n/sign";

export type Handler<Ctx> = (req: Request, ctx: Ctx) => Promise<Response> | Response;

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}
export function bad(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Wrap a route: catches AuthError/zod/other errors into JSON. */
export function route<Ctx>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof AuthError) return bad(err.message, err.status);
      if (err instanceof z.ZodError) return bad("invalid input", 422, { issues: err.issues });
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[api]", msg);
      return bad(msg, 500);
    }
  };
}

/** The Business Office tablet: a valid PIN cookie acts as the owner (spec §9 — approvals from the office). */
export async function officeSession(): Promise<StaffSession | null> {
  const jar = await cookies();
  const tok = jar.get(OFFICE_COOKIE)?.value;
  return verifyOfficeToken(tok) ? { userId: "office-tablet", email: null, name: "Business Office", role: "owner" } : null;
}

/** Staff-only route. The office PIN cookie also passes (as owner). */
export function staffRoute<Ctx>(roles: StaffRole[] | undefined, handler: (req: Request, ctx: Ctx, staff: StaffSession) => Promise<Response> | Response): Handler<Ctx> {
  return route(async (req, ctx) => {
    const office = await officeSession();
    const staff = office ?? (await requireStaff(roles));
    return handler(req, ctx, staff);
  });
}

/**
 * Staff OR n8n-signed. Reads the raw body once (so the signature covers it) and hands it back parsed.
 * n8n-signed calls act as the "n8n" actor with owner-level access.
 */
export function staffOrSignedRoute<Ctx>(roles: StaffRole[] | undefined, handler: (req: Request, ctx: Ctx, staff: StaffSession, body: unknown) => Promise<Response> | Response): Handler<Ctx> {
  return route(async (req, ctx) => {
    const raw = await req.text();
    const body = raw ? (() => { try { return JSON.parse(raw) as unknown; } catch { return null; } })() : {};
    if (verify(raw, req.headers.get(SIGNATURE_HEADER))) {
      return handler(req, ctx, { userId: "n8n", email: null, name: "n8n", role: "owner" }, body);
    }
    const office = await officeSession();
    const staff = office ?? (await requireStaff(roles));
    return handler(req, ctx, staff, body);
  });
}

export async function parse<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  const body = await req.json().catch(() => ({}));
  return schema.parse(body);
}

export async function params<T extends Record<string, string>>(ctx: { params: Promise<T> }): Promise<T> {
  return ctx.params;
}

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "0.0.0.0";
}

/** Tiny in-memory limiter (per instance). Good enough as a first fence. */
const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) { buckets.set(key, { n: 1, reset: now + windowMs }); return true; }
  if (b.n >= max) return false;
  b.n++;
  return true;
}

export { currentStaff };
