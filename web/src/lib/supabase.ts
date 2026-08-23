import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Baked-in defaults for zero-config deploys (Railway, Netlify, anywhere).
// Both values are DESIGNED to ship in a browser bundle: the publishable key
// grants only what the RLS policies allow, nothing more. Env vars still win
// when set, so pointing a deploy at a different Supabase project stays a
// config change, not a code change.
const DEFAULT_URL = "https://qmztuagvxopahowexrum.supabase.co";
const DEFAULT_KEY = "sb_publishable_cbwgMdVv6XDxLp0WOBsM-w_irvs7BAh";

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_KEY;

/** Always true now that defaults are baked in; kept for the components. */
export const isConfigured = Boolean(url && key);

export const supabase = createClient<Database>(
  url,
  key,
  {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  },
);
