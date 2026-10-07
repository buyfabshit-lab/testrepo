import "server-only";
import { env } from "@/lib/env";

/** ShipStation (spec §7.8): create label, store tracking. */
const BASE = "https://ssapi.shipstation.com";

export function shipstationConfigured(): boolean {
  return Boolean(env.shipstationApiKey() && env.shipstationApiSecret());
}

async function ss<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!shipstationConfigured()) throw new Error("ShipStation not configured");
  const auth = Buffer.from(`${env.shipstationApiKey()}:${env.shipstationApiSecret()}`).toString("base64");
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { authorization: `Basic ${auth}`, "content-type": "application/json", ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`ShipStation ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

export interface Address { name: string; company?: string | null; street1: string; street2?: string | null; city: string; state: string; postalCode: string; country?: string; phone?: string | null }
export interface LabelRequest {
  orderNumber: number; shipTo: Address; weightOz: number; carrierCode?: string; serviceCode?: string; packageCode?: string;
  testLabel?: boolean;
}
export interface LabelResult { trackingNumber: string; labelData: string; carrierCode: string; serviceCode: string; shipmentCost: number }

export const SHIP_FROM: Address = {
  name: "Midnight Fusion", company: "Midnight Fusion LLC",
  street1: process.env.SHIP_FROM_STREET ?? "", city: process.env.SHIP_FROM_CITY ?? "", state: process.env.SHIP_FROM_STATE ?? "CA",
  postalCode: process.env.SHIP_FROM_ZIP ?? "", country: "US",
};

/** Buy a label. Returns base64 PDF label data + tracking. Test labels unless LIVE_MONEY=true. */
export async function createLabel(req: LabelRequest): Promise<LabelResult> {
  const body = {
    carrierCode: req.carrierCode ?? "stamps_com",
    serviceCode: req.serviceCode ?? "usps_ground_advantage",
    packageCode: req.packageCode ?? "package",
    confirmation: "none",
    shipDate: new Date().toISOString().slice(0, 10),
    weight: { value: req.weightOz, units: "ounces" },
    shipFrom: { ...SHIP_FROM, country: "US" },
    shipTo: { ...req.shipTo, country: req.shipTo.country ?? "US" },
    testLabel: req.testLabel ?? !env.liveMoney(),
  };
  return ss<LabelResult>("/shipments/createlabel", { method: "POST", body: JSON.stringify(body) });
}

export function trackingUrl(carrier: string, tracking: string): string {
  const c = carrier.toLowerCase();
  if (c.includes("ups")) return `https://www.ups.com/track?tracknum=${tracking}`;
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${tracking}`;
  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}`;
}
