import { BOARD_LANES, STATUS_COLORS, STATUS_LABELS } from "@/lib/orders/status";
import { ROOMS, roomHref, type RoomSlug } from "./rooms";
import type { LaneCounts } from "./data";

/**
 * The Clubhouse as a 2D building cutaway. Original line art, inline SVG,
 * no external assets. Every room is an <a>; the flat menu under the map is
 * the primary UI on phones and always renders (see app/world/page.tsx).
 */
interface Box { slug: RoomSlug; x: number; y: number; w: number; h: number; label?: string; sub?: string }

const UPPER = 70, GROUND = 250, STREET = 445;
const BOXES: Box[] = [
  // upper floor
  { slug: "office",     x: 40,  y: UPPER,  w: 170, h: 150, label: "BUSINESS OFFICE", sub: "PIN WALL" },
  { slug: "arcade",     x: 225, y: UPPER,  w: 150, h: 150, label: "ARCADE",          sub: "INSERT COIN" },
  { slug: "vault",      x: 390, y: UPPER,  w: 190, h: 150, label: "THE VAULT",       sub: "GRAPHICS" },
  { slug: "back-room",  x: 595, y: UPPER,  w: 175, h: 150, label: "BACK ROOM",       sub: "DEATH SQUAD STORE" },
  { slug: "rf-dc",      x: 785, y: UPPER,  w: 175, h: 150, label: "RF × DEATH CORPS", sub: "CLUBHOUSE" },
  // ground floor
  { slug: "gate",       x: 40,  y: GROUND, w: 200, h: 165, label: "FRONT GATE / BAR", sub: "INTAKE" },
  { slug: "floor",      x: 255, y: GROUND, w: 500, h: 165, label: "PRINT FLOOR",     sub: "GARAGE BAYS" },
  { slug: "dock",       x: 770, y: GROUND, w: 190, h: 165, label: "LOADING DOCK",    sub: "SHIPMENTS" },
  // street level
  { slug: "district",   x: 40,  y: STREET, w: 250, h: 130, label: "SUPPLIER ROW",    sub: "THE DISTRICT" },
  { slug: "skrewu-lot", x: 305, y: STREET, w: 200, h: 130, label: "SKREW U LOT",     sub: "LISTINGS" },
  { slug: "showroom",   x: 520, y: STREET, w: 215, h: 130, label: "THE LOT / LINEUP", sub: "WHOLESALE SHOWROOM" },
  { slug: "drive-in",   x: 750, y: STREET, w: 210, h: 130, label: "DRIVE-IN",        sub: "CONCESSION" },
];

const BAY_DOOR_COUNT = 3;

export default function ClubhouseMap({ laneCounts }: { laneCounts: LaneCounts }) {
  const floor = BOXES.find((b) => b.slug === "floor")!;
  const nameOf = (slug: RoomSlug) => ROOMS.find((r) => r.slug === slug)?.name ?? slug;
  return (
    <figure className="panel relative overflow-hidden" aria-label="Map of the Death Squad Clubhouse">
      <svg viewBox="0 0 1000 620" role="group" className="block w-full h-auto select-none" aria-label="Clubhouse floor plan">
        <style>{`
          .room rect.wall { fill: var(--mf-panel); stroke: var(--mf-line); stroke-width: 2; transition: stroke .15s, fill .15s, filter .15s; }
          .room text { fill: var(--mf-cream); font-family: var(--font-display), Impact, sans-serif; letter-spacing: .08em; text-transform: uppercase; }
          .room text.sub { fill: var(--mf-muted); font-family: var(--font-mono), monospace; font-size: 9px; letter-spacing: .14em; }
          .room:hover rect.wall, .room:focus-visible rect.wall { stroke: var(--mf-gold); fill: #1d1a13; filter: drop-shadow(0 0 10px rgba(212,169,79,.55)); }
          .room:hover text, .room:focus-visible text { fill: var(--mf-gold); }
          .room.locked rect.wall { stroke-dasharray: 6 4; }
          .room { outline: none; cursor: pointer; }
          .bone { stroke: var(--mf-line); stroke-width: 2; fill: none; }
          .ink { fill: var(--mf-dim); font-family: var(--font-mono), monospace; font-size: 9px; letter-spacing: .14em; }
        `}</style>

        {/* roofline + floor slabs */}
        <polygon points="20,52 500,8 980,52" className="bone" />
        <line x1="20" y1="52" x2="980" y2="52" className="bone" />
        <line x1="20" y1={GROUND - 12} x2="980" y2={GROUND - 12} className="bone" />
        <line x1="20" y1={STREET - 12} x2="980" y2={STREET - 12} className="bone" />
        <line x1="20" y1="52" x2="20" y2={STREET - 12} className="bone" />
        <line x1="980" y1="52" x2="980" y2={STREET - 12} className="bone" />
        <text x="500" y="38" textAnchor="middle" className="ink">DEATH SQUAD CLUBHOUSE · MIDNIGHT FUSION</text>
        <text x="24" y={GROUND - 18} className="ink">UPSTAIRS</text>
        <text x="24" y={STREET - 18} className="ink">GROUND FLOOR</text>
        <text x="24" y={STREET + 150} className="ink">THE STREET</text>
        <line x1="20" y1={STREET + 140} x2="980" y2={STREET + 140} className="bone" strokeDasharray="12 10" />

        {/* intercom speaker box on the roof */}
        <a href={roomHref("intercom")} className="room" aria-label={nameOf("intercom")}>
          <rect x="455" y="14" width="90" height="30" rx="3" className="wall" />
          <circle cx="472" cy="29" r="6" fill="none" stroke="var(--mf-gold)" strokeWidth="1.5" />
          <circle cx="472" cy="29" r="2" fill="var(--mf-blood)" />
          <text x="486" y="33" fontSize="11">INTERCOM</text>
        </a>

        {BOXES.map((b) => {
          const room = ROOMS.find((r) => r.slug === b.slug);
          return (
            <a key={b.slug} href={roomHref(b.slug)} className={`room${room?.locked ? " locked" : ""}`} aria-label={room?.name ?? b.slug}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} className="wall" />
              {/* door */}
              <rect x={b.x + b.w / 2 - 10} y={b.y + b.h - 26} width="20" height="26" fill="var(--mf-bg)" stroke="var(--mf-line)" />
              <circle cx={b.x + b.w / 2 + 5} cy={b.y + b.h - 13} r="1.6" fill="var(--mf-gold)" />
              <text x={b.x + 12} y={b.y + 26} fontSize="15">{b.label}</text>
              {b.sub && <text x={b.x + 12} y={b.y + 42} className="sub">{b.sub}</text>}
              {room?.locked && <text x={b.x + b.w - 12} y={b.y + 26} textAnchor="end" fontSize="12" fill="var(--mf-blood)">PIN</text>}
            </a>
          );
        })}

        {/* Print Floor: garage bay doors + a status dot per lane (same hex as the dashboard) */}
        {Array.from({ length: BAY_DOOR_COUNT }, (_, i) => {
          const w = 58, gap = 14, x = floor.x + floor.w - (w + gap) * (BAY_DOOR_COUNT - i) + gap / 2;
          return (
            <g key={i} pointerEvents="none">
              <rect x={x} y={floor.y + floor.h - 60} width={w} height="60" fill="var(--mf-bg)" stroke="var(--mf-line)" />
              {[0, 1, 2, 3].map((r) => <line key={r} x1={x} y1={floor.y + floor.h - 48 + r * 12} x2={x + w} y2={floor.y + floor.h - 48 + r * 12} stroke="var(--mf-line)" />)}
            </g>
          );
        })}
        <g pointerEvents="none">
          {BOARD_LANES.map((lane, i) => {
            const perRow = 6, col = i % perRow, row = Math.floor(i / perRow);
            const cx = floor.x + 20 + col * 40, cy = floor.y + 68 + row * 36;
            const n = laneCounts[lane] ?? 0;
            return (
              <g key={lane}>
                <title>{`${STATUS_LABELS[lane]}: ${n}`}</title>
                <circle cx={cx} cy={cy} r={n > 0 ? 7 : 4} fill={STATUS_COLORS[lane].hex} opacity={n > 0 ? 1 : 0.35} stroke={lane === "DONE" ? "var(--mf-line)" : "none"} />
                <text x={cx + 11} y={cy + 4} fontSize="11" fill="var(--mf-cream)" fontFamily="var(--font-mono), monospace">{n}</text>
              </g>
            );
          })}
        </g>
      </svg>
      <figcaption className="border-t border-mf-line px-3 py-2 text-[10px] uppercase tracking-[.14em] text-mf-dim">
        Tap a room. Dots on the Print Floor are the board lanes — same colors as the dashboard.
      </figcaption>
    </figure>
  );
}
