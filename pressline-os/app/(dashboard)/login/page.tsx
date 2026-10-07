import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

function safeNext(v: string | string[] | undefined): string {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s || !s.startsWith("/") || s.startsWith("//")) return "/app";
  return s;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const reason = Array.isArray(sp.reason) ? sp.reason[0] : sp.reason;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <p className="text-xs uppercase tracking-[.3em] text-mf-muted">Midnight Fusion LLC</p>
      <h1 className="mt-1 text-5xl text-mf-gold">PRESSLINE</h1>
      <p className="mt-2 text-sm text-mf-muted">Staff sign-in. Jeff, Justin, Danny — you know the drill.</p>
      {reason === "env" ? (
        <p className="mt-4 border border-mf-blood p-3 text-sm text-mf-cream">Supabase env vars are missing on the server. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.</p>
      ) : null}
      <LoginForm next={next} reason={reason ?? null} />
    </main>
  );
}
