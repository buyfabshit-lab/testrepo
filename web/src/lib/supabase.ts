import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * True when both env vars are present. The whole site degrades to a static
 * shell rather than crashing when they are not, so a misconfigured deploy
 * still renders something explainable instead of a white screen.
 */
export const isConfigured = Boolean(url && key);

export const supabase = createClient<Database>(
  url ?? "https://placeholder.supabase.co",
  key ?? "placeholder",
  {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  },
);
