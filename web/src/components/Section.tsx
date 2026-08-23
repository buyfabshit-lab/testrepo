import type { ReactNode } from "react";

export function Section({
  id,
  eyebrow,
  title,
  aside,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-hot-400">
            {eyebrow}
          </p>
          <h2 className="mt-1.5 font-display text-3xl font-extrabold tracking-tight text-bone sm:text-4xl">
            {title}
          </h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
