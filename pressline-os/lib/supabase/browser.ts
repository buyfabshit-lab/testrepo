"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

let client: ReturnType<typeof createBrowserClient<Database, "pressline">> | null = null;

export function browserClient() {
  if (client) return client;
  client = createBrowserClient<Database, "pressline">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "pressline" } },
  );
  return client;
}
