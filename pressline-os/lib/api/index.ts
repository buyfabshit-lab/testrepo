import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, currentStaff, requireStaff, type StaffRole, type StaffSession } from "@/lib/auth/staff";

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

/** Staff-only route. */
export function staffRoute<Ctx>(roles: StaffRole[] | undefined, handler: (req: Request, ctx: Ctx, staff: StaffSession) => Promise<Response> | Response): Handler<Ctx> {
  return route(async (req, ctx) => {
    const staff = await requireStaff(roles);
    return handler(req, ctx, staff);
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
