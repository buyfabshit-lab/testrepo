/** The order state machine (spec §6). Same colors on dashboard, Jeff's app, and the world. */
export const ORDER_STATUSES = [
  "NEW", "QUOTED", "APPROVED", "PAID", "BLANKS_ORDERED", "ART_READY",
  "ON_GANG_SHEET", "PRINTED", "PACKED", "SHIPPED", "DONE", "HOLD", "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_COLORS: Record<OrderStatus, { name: string; hex: string; text: string }> = {
  NEW:            { name: "gray",   hex: "#6b7280", text: "#ffffff" },
  QUOTED:         { name: "blue",   hex: "#2563eb", text: "#ffffff" },
  APPROVED:       { name: "purple", hex: "#7c3aed", text: "#ffffff" },
  PAID:           { name: "green",  hex: "#16a34a", text: "#ffffff" },
  BLANKS_ORDERED: { name: "teal",   hex: "#0d9488", text: "#ffffff" },
  ART_READY:      { name: "yellow", hex: "#eab308", text: "#111111" },
  ON_GANG_SHEET:  { name: "orange", hex: "#ea580c", text: "#ffffff" },
  PRINTED:        { name: "pink",   hex: "#db2777", text: "#ffffff" },
  PACKED:         { name: "brown",  hex: "#92400e", text: "#ffffff" },
  SHIPPED:        { name: "cyan",   hex: "#0891b2", text: "#ffffff" },
  DONE:           { name: "black",  hex: "#111111", text: "#ffffff" },
  HOLD:           { name: "red",    hex: "#dc2626", text: "#ffffff" },
  CANCELLED:      { name: "slate",  hex: "#334155", text: "#ffffff" },
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "New", QUOTED: "Quoted", APPROVED: "Approved", PAID: "Paid",
  BLANKS_ORDERED: "Blanks ordered", ART_READY: "Art ready", ON_GANG_SHEET: "On gang sheet",
  PRINTED: "Printed", PACKED: "Packed", SHIPPED: "Shipped", DONE: "Done", HOLD: "Hold", CANCELLED: "Cancelled",
};

/** Lanes shown on the production board, in order. HOLD and CANCELLED are side lanes. */
export const BOARD_LANES: OrderStatus[] = [
  "NEW", "QUOTED", "APPROVED", "PAID", "BLANKS_ORDERED", "ART_READY",
  "ON_GANG_SHEET", "PRINTED", "PACKED", "SHIPPED", "DONE", "HOLD",
];

/** Allowed forward transitions. HOLD can be entered from anywhere before SHIPPED and released to the prior status. */
const FORWARD: Record<OrderStatus, OrderStatus[]> = {
  NEW:            ["QUOTED", "HOLD", "CANCELLED"],
  QUOTED:         ["APPROVED", "HOLD", "CANCELLED"],
  APPROVED:       ["PAID", "HOLD", "CANCELLED"],
  PAID:           ["BLANKS_ORDERED", "ART_READY", "HOLD", "CANCELLED"],
  BLANKS_ORDERED: ["ART_READY", "HOLD", "CANCELLED"],
  ART_READY:      ["ON_GANG_SHEET", "HOLD"],
  ON_GANG_SHEET:  ["PRINTED", "HOLD"],
  PRINTED:        ["PACKED", "HOLD"],
  PACKED:         ["SHIPPED", "HOLD"],
  SHIPPED:        ["DONE"],
  DONE:           [],
  HOLD:           ["NEW", "QUOTED", "APPROVED", "PAID", "BLANKS_ORDERED", "ART_READY", "ON_GANG_SHEET", "PRINTED", "PACKED", "CANCELLED"],
  CANCELLED:      [],
};

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === "string" && (ORDER_STATUSES as readonly string[]).includes(v);
}

/**
 * Can `from` move to `to`?  Owners may force any move (dashboard drag with
 * `force: true`), everyone else follows the machine.
 */
export function canTransition(from: OrderStatus, to: OrderStatus, opts: { force?: boolean } = {}): boolean {
  if (from === to) return false;
  if (opts.force) return true;
  return FORWARD[from].includes(to);
}

/** Who should hear about this status change (spec §8 status-pings). */
export function audienceFor(status: OrderStatus): Array<"jeff" | "danny" | "customer" | "justin"> {
  switch (status) {
    case "QUOTED": return ["customer"];
    case "APPROVED": return ["customer", "justin"];
    case "PAID": return ["jeff", "justin"];
    case "BLANKS_ORDERED": return ["jeff"];
    case "ART_READY": return ["danny"];
    case "ON_GANG_SHEET": return ["danny", "jeff"];
    case "PRINTED": return ["jeff"];
    case "PACKED": return ["jeff"];
    case "SHIPPED": return ["customer"];
    case "DONE": return ["customer"];
    case "HOLD": return ["justin"];
    default: return [];
  }
}
