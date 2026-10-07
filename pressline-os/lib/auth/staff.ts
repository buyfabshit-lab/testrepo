import "server-only";
import { serverClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/service";

export type StaffRole = "owner" | "production" | "print" | "ship";
export interface StaffSession { userId: string; email: string | null; name: string | null; role: StaffRole }

/** The signed-in staff member, or null. Uses the cookie session + the staff table. */
export async function currentStaff(): Promise<StaffSession | null> {
  const supa = await serverClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return null;
  const { data: staff } = await db().from("staff").select("id, name, role").eq("id", user.id).maybeSingle();
  if (!staff) return null;
  return { userId: user.id, email: user.email ?? null, name: staff.name, role: staff.role as StaffRole };
}

export async function requireStaff(roles?: StaffRole[]): Promise<StaffSession> {
  const s = await currentStaff();
  if (!s) throw new AuthError("Sign in required", 401);
  if (roles && !roles.includes(s.role)) throw new AuthError(`Requires role ${roles.join("|")}`, 403);
  return s;
}

export class AuthError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Map a staff session to the actor name Outlaw uses in the log. */
export function actorFor(s: StaffSession | null): string {
  if (!s) return "system";
  const n = (s.name ?? s.email ?? "").toLowerCase();
  if (n.includes("justin")) return "justin";
  if (n.includes("jeff")) return "jeff";
  if (n.includes("danny")) return "danny";
  return s.role;
}
