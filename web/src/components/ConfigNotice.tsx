/** Shown instead of silently dead panels when the Supabase env vars are absent. */
export function ConfigNotice() {
  return (
    <div className="rounded-3xl border border-gold-400/30 bg-gold-400/5 p-6">
      <h3 className="font-display text-lg font-bold text-gold-400">
        Not connected to Supabase
      </h3>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ash">
        The live features need <code className="text-bone/90">VITE_SUPABASE_URL</code> and{" "}
        <code className="text-bone/90">VITE_SUPABASE_PUBLISHABLE_KEY</code>. Copy{" "}
        <code className="text-bone/90">.env.example</code> to{" "}
        <code className="text-bone/90">.env</code> (or set them in your host's
        environment) and reload. Everything else on the page still works.
      </p>
    </div>
  );
}
