import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./types";

export const SCHEMA = "pressline" as const;

let cached: SupabaseClient<Database, "pressline"> | null = null;

/**
 * Service-role client. Server routes ONLY. Bypasses RLS, so every route that
 * uses it must do its own authorization (staff session, proof token, HMAC).
 */
export function serviceClient(): SupabaseClient<Database, "pressline"> {
  if (cached) return cached;
  cached = createClient<Database, "pressline">(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    db: { schema: SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** Shorthand: `db().from("orders")` already scoped to the pressline schema. */
export const db = serviceClient;
