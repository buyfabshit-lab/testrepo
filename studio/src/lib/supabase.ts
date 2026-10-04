import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export const UPLOAD_BUCKET = "studio-uploads";

/**
 * Anonymous sessions keep saved designs private per browser without a login
 * wall. Requires "Allow anonymous sign-ins" in Supabase Auth settings.
 */
export async function ensureSession(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn("[studio] anonymous sign-in failed:", error.message);
    return null;
  }
  return anon.user?.id ?? null;
}
