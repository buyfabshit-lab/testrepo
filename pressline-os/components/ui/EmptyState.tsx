export function EmptyState({ title = "Nothing here", hint, action }: { title?: string; hint?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="panel border-dashed p-8 text-center">
      <p className="font-display text-xl uppercase tracking-widest text-mf-dim">{title}</p>
      {hint ? <p className="mt-2 text-sm text-mf-muted">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
