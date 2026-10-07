"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/Button";

type Mode = "password" | "magic";

export function LoginForm({ next, reason }: { next: string; reason: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const notStaff = reason === "notstaff";

  // Magic links land back here with the auth code; the browser client exchanges it and fires SIGNED_IN.
  useEffect(() => {
    const supa = browserClient();
    let cancelled = false;
    if (!notStaff) {
      supa.auth.getSession().then(({ data }) => {
        if (!cancelled && data.session) { router.replace(next); router.refresh(); }
      });
    }
    const { data: sub } = supa.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") { router.replace(next); router.refresh(); }
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [next, router, notStaff]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const supa = browserClient();
    try {
      if (mode === "password") {
        const { error } = await supa.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.push(next);
        router.refresh();
      } else {
        const redirectTo = `${window.location.origin}/login?next=${encodeURIComponent(next)}`;
        const { error } = await supa.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
        setSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel mt-8 p-5">
      {notStaff ? (
        <div className="mb-5 border border-mf-blood p-3 text-sm">
          <p className="font-bold text-mf-cream">You are signed in, but this account is not on staff.</p>
          <p className="mt-1 text-mf-muted">Ask Justin to add your user id to <span className="font-mono">pressline.staff</span>, or sign out and use another account.</p>
          <button type="button" className="btn mt-3 !px-2.5 !py-1 !text-[.65rem]" onClick={async () => { await browserClient().auth.signOut(); router.refresh(); }}>Sign out</button>
        </div>
      ) : null}
      <div className="mb-5 flex border-b border-mf-line text-xs font-bold uppercase tracking-widest">
        {(["password", "magic"] as Mode[]).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setError(null); setSent(false); }}
            className={`-mb-px border-b-2 px-3 py-2 ${mode === m ? "border-mf-gold text-mf-gold" : "border-transparent text-mf-dim"}`}>
            {m === "password" ? "Password" : "Magic link"}
          </button>
        ))}
      </div>

      <label className="label" htmlFor="email">Email</label>
      <input id="email" className="input mb-4" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />

      {mode === "password" ? (
        <>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" className="input mb-4" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </>
      ) : null}

      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
      {sent ? <p className="mb-3 text-sm text-mf-gold">Link sent. Check your email on this phone and tap it.</p> : null}

      <Button type="submit" variant="solid" size="lg" className="w-full justify-center" loading={busy}>
        {mode === "password" ? "Sign in" : "Email me a link"}
      </Button>
    </form>
  );
}
