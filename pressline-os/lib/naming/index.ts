/**
 * Auto file naming (spec §5 designs.file_name):
 *   {ORDER}-{BRAND}-{SKU}-{LOC}-{YYYYMMDD}.png
 *   1042-DC-G5000-FRONT-20261007.png
 * Nobody types a filename; the engine writes it at save.
 */
export const BRAND_CODES: Record<string, string> = {
  death_corps: "DC", death_squad: "DS", skrew_u: "SU", valhalla: "VM",
  odins_reich: "OR", combatant: "CB", black_metal: "BM", customer: "CU", camo: "CM",
};

export function brandCode(brand: string | null | undefined): string {
  if (!brand) return "CU";
  const key = brand.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return BRAND_CODES[key] ?? brand.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) ?? "CU";
}

export function skuPart(style: string | null | undefined, brand?: string | null): string {
  const s = (style ?? "NA").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const b = (brand ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1);
  return `${b}${s}`.slice(0, 12) || "NA";
}

export function locPart(location: string | null | undefined): string {
  const l = (location ?? "front").toUpperCase().replace(/[^A-Z0-9]+/g, "");
  return l || "FRONT";
}

/** Pacific calendar date as YYYYMMDD. */
export function yyyymmdd(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(d).replace(/-/g, "");
}

export function pacificDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function printFileName(input: {
  orderNumber: number | string | null | undefined;
  brand?: string | null;
  blankStyle?: string | null;
  blankBrand?: string | null;
  location?: string | null;
  date?: Date;
  ext?: "png" | "pdf";
}): string {
  const order = input.orderNumber ?? "DRAFT";
  return `${order}-${brandCode(input.brand)}-${skuPart(input.blankStyle, input.blankBrand)}-${locPart(input.location)}-${yyyymmdd(input.date)}.${input.ext ?? "png"}`;
}

/** Storage path inside the `artwork` bucket. */
export function printFileStoragePath(orderNumber: number | string | null | undefined, fileName: string): string {
  return `print-files/${orderNumber ?? "draft"}/${fileName}`;
}

/** gang-sheets/2026-10-07/PL-20261007-1.png */
export function sheetFileName(runDate: string, sheetNumber: number, ext: "png" | "pdf" = "png"): string {
  return `PL-${runDate.replace(/-/g, "")}-${sheetNumber}.${ext}`;
}

/** Drive FUSION INTAKE subfolders Outlaw routes into (spec §7.10 + §7.7). */
export const DRIVE_FOLDERS = {
  INCOMING: "00 — INCOMING",
  TO_GANG_SHEET: "01 TO GANG SHEET",
  ART_FILES: "Art Files",
  CLIENT_REQUESTS: "Client Requests",
  CUSTOMER_FILES: "Customer Files",
  ARTWORK: "Artwork",
  VECTORS: "Vectors",
  FONTS: "Fonts",
  PRINT_READY_OUT: "99 — PRINT READY (OUT)",
} as const;
