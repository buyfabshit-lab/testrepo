export function PresenceBadge({ count, handles }: { count: number; handles: string[] }) {
  const label = `${count} ${count === 1 ? "person" : "people"} in the room`;

  return (
    <div
      className="group relative flex items-center gap-2.5 rounded-full glass px-3.5 py-2"
      title={handles.length ? handles.join(" · ") : undefined}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span
          className="absolute inline-flex h-full w-full rounded-full bg-emerald-400"
          style={{ animation: "pulse-ring 2s cubic-bezier(0,0,0.2,1) infinite" }}
        />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <span className="text-xs font-medium tabular-nums text-bone/85">
        <span className="font-semibold">{count}</span>
        <span className="ml-1.5 text-ash">here now</span>
      </span>
      <span className="sr-only">{label}</span>
    </div>
  );
}
