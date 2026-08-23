/**
 * Poster-style marquee band under the hero. Pure CSS animation, duplicated
 * content for a seamless loop; prefers-reduced-motion freezes it globally
 * (see index.css).
 */
export function Ticker({ name, location }: { name: string; location: string | null }) {
  const line = `${name} \u2022 live from ${location ?? "the void"} \u2022 pull up \u2022 `;
  const run = line.repeat(6);

  return (
    <div
      aria-hidden
      className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden bg-hot-500 py-2.5"
      style={{ transform: "translateX(-50%) rotate(-0.6deg) scale(1.01)" }}
    >
      <div
        className="flex w-max whitespace-nowrap"
        style={{ animation: "marquee 28s linear infinite" }}
      >
        <span className="display-caps pr-2 text-sm font-bold tracking-[0.14em] text-void">
          {run}
        </span>
        <span className="display-caps pr-2 text-sm font-bold tracking-[0.14em] text-void">
          {run}
        </span>
      </div>
    </div>
  );
}
