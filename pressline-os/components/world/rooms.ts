/**
 * The Clubhouse room registry. One row per room, one route per row.
 * Every room is a skin over an existing PRESSLINE module — nothing lives only here.
 */
export type RoomSlug =
  | "gate" | "office" | "arcade" | "vault" | "floor" | "dock" | "district"
  | "back-room" | "rf-dc" | "skrewu-lot" | "drive-in" | "showroom" | "intercom";

export interface Room {
  slug: RoomSlug;
  /** Name painted on the door. */
  name: string;
  /** One line, in Outlaw's voice. */
  tag: string;
  /** The PRESSLINE module this room skins. */
  module: string;
  /** PIN wall in front of it. */
  locked?: boolean;
}

export const ROOMS: Room[] = [
  { slug: "gate",       name: "Front Gate / Bar",            tag: "Say who you are. Get a drink. Get a quote.",       module: "Intake + capture" },
  { slug: "office",     name: "Business Office",             tag: "PIN wall. Approvals only.",                        module: "Quotes + POs (PIN-locked)", locked: true },
  { slug: "arcade",     name: "Arcade Cabinet",              tag: "Black tee. UV sticker. Insert coin.",              module: "Design Studio (arcade mode)" },
  { slug: "vault",      name: "The Vault",                   tag: "Every graphic we ever cut.",                       module: "Vault browser" },
  { slug: "floor",      name: "Print Floor / Garage Bays",   tag: "Where the lanes move. Read-only from here.",       module: "Production board" },
  { slug: "dock",       name: "Loading Dock",                tag: "Labels, tracking, gone.",                          module: "Shipments" },
  { slug: "district",   name: "Supplier Row (the District)", tag: "Five storefronts. Blanks, thread, ink.",           module: "Suppliers" },
  { slug: "back-room",  name: "The Back Room",               tag: "Death Squad store. Cash through Stripe.",          module: "Store: death-squad" },
  { slug: "rf-dc",      name: "RF × Death Corps Clubhouse",  tag: "Death Corps drops. Shopify side door.",            module: "Store: death-corps" },
  { slug: "skrewu-lot", name: "Skrew U Lot",                 tag: "Skrew U listings, parked out back.",               module: "Store: skrew-u" },
  { slug: "drive-in",   name: "Drive-In Concession",         tag: "Featured drops + the pop-up window.",              module: "Pop-up group stores" },
  { slug: "showroom",   name: "The Lot / Lineup Showroom",   tag: "Wholesale. Tiers and minimums, no haggling.",      module: "Wholesale portal" },
  { slug: "intercom",   name: "Intercom",                    tag: "Outlaw on the horn.",                              module: "Outlaw broadcast + chat" },
];

export function roomHref(slug: RoomSlug): string {
  return `/world/${slug}`;
}

export function roomBySlug(slug: string | undefined | null): Room | undefined {
  return ROOMS.find((r) => r.slug === slug);
}

/** `/world/office/...` → the office room; `/world` → undefined (the map). */
export function roomByPath(pathname: string | null | undefined): Room | undefined {
  if (!pathname) return undefined;
  const seg = pathname.replace(/^\/world\/?/, "").split("/")[0];
  return roomBySlug(seg);
}
