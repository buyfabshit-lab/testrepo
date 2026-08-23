/**
 * Ambient background: three slow-drifting colour fields plus a scanline
 * wash. Pure CSS animation so it costs nothing on the main thread, and it
 * freezes entirely under prefers-reduced-motion (handled in index.css).
 */
export function Backdrop({ live }: { live: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-void" />

      <div
        className="absolute -left-[20%] -top-[25%] h-[70vmax] w-[70vmax] rounded-full blur-[120px] transition-opacity duration-1000"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--color-hot-500) 55%, transparent), transparent 62%)",
          opacity: live ? 0.5 : 0.28,
          animation: "drift-a 26s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute -right-[15%] top-[10%] h-[55vmax] w-[55vmax] rounded-full blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--color-gold-500) 42%, transparent), transparent 62%)",
          opacity: 0.22,
          animation: "drift-b 34s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute bottom-[-25%] left-[25%] h-[60vmax] w-[60vmax] rounded-full blur-[140px]"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, #7a0e1d 65%, transparent), transparent 64%)",
          opacity: 0.24,
          animation: "drift-c 30s ease-in-out infinite alternate",
        }}
      />

      {/* Faint horizontal scanlines — CRT texture without the headache. */}
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.055) 0px, rgba(255,255,255,0.055) 1px, transparent 1px, transparent 4px)",
        }}
      />

      <style>{`
        @keyframes drift-a { to { transform: translate3d(12vw, 8vh, 0) scale(1.15); } }
        @keyframes drift-b { to { transform: translate3d(-14vw, 12vh, 0) scale(1.2); } }
        @keyframes drift-c { to { transform: translate3d(8vw, -10vh, 0) scale(1.1); } }
      `}</style>
    </div>
  );
}
