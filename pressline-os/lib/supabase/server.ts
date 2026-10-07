import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "./types";

/** Cookie-session client (RLS applies). Use for staff pages + auth checks. */
export async function serverClient() {
  const cookieStore = await cookies();
  return createServerClient<Database, "pressline">(env.supabaseUrl(), env.supabaseAnonKey(), {
    db: { schema: "pressline" },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          /* called from a Server Component; middleware refreshes the session */
        }
      },
    },
  });
}
