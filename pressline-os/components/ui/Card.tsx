export function Card({ title, action, children, className = "", padded = true }: {
  title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; padded?: boolean;
}) {
  return (
    <section className={`panel ${padded ? "p-4" : ""} ${className}`}>
      {(title || action) && (
        <header className={`flex items-center justify-between gap-3 ${padded ? "mb-3" : "p-4 pb-0"}`}>
          {title ? <h2 className="text-lg text-mf-gold">{title}</h2> : <span />}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl text-mf-gold sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-mf-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Stat({ label, value, tone = "gold" }: { label: string; value: React.ReactNode; tone?: "gold" | "cream" | "blood" }) {
  const color = tone === "blood" ? "text-mf-blood" : tone === "cream" ? "text-mf-cream" : "text-mf-gold";
  return (
    <div className="panel p-3">
      <p className="label !mb-1">{label}</p>
      <p className={`font-display text-3xl ${color}`}>{value}</p>
    </div>
  );
}
