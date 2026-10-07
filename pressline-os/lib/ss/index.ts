import "server-only";
import { env, moneyIsLive } from "@/lib/env";

/**
 * S&S Activewear API (ported from the Standalone app; Manus-free).
 * Live stock / price / photos. Orders only after approval AND LIVE_MONEY=true.
 */
const BASE_URL = "https://api.ssactivewear.com/v2";

function authHeader() {
  return `Basic ${Buffer.from(`${env.ssAccountNumber()}:${env.ssApiKey()}`).toString("base64")}`;
}
export function ssConfigured(): boolean {
  return Boolean(env.ssAccountNumber() && env.ssApiKey());
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ssFetch<T>(endpoint: string, init: RequestInit = {}, attempt = 0): Promise<T> {
  if (!ssConfigured()) throw new Error("S&S not configured (SS_ACCOUNT_NUMBER / SS_API_KEY)");
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...init,
    headers: { authorization: authHeader(), accept: "application/json", "content-type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    const throttled = res.status === 429 || /throttl/i.test(text);
    if (throttled && attempt < 3) {
      await sleep(600 * (attempt + 1));
      return ssFetch<T>(endpoint, init, attempt + 1);
    }
    if (res.status === 404) return [] as unknown as T;
    throw new Error(`S&S ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export interface SSStyle { styleID: number; brandName: string; styleName: string; title: string; baseCategory: string; styleImage?: string }
export interface SSProduct {
  sku: string; styleID: number; brandName: string; styleName: string; colorName: string; colorCode?: string;
  sizeName: string; qty: number; customerPrice: number; colorFrontImage?: string; colorBackImage?: string; colorSideImage?: string;
  warehouses?: Array<{ warehouseAbbr: string; qty: number }>;
}

export const POPULAR_STYLES: Record<string, { styleID: number; brand: string; name: string; category: string }> = {
  gildan_5000: { styleID: 16, brand: "Gildan", name: "5000", category: "T-Shirts" },
  bella_3001: { styleID: 29, brand: "Bella+Canvas", name: "3001", category: "T-Shirts" },
  comfort_colors_1717: { styleID: 1822, brand: "Comfort Colors", name: "1717", category: "T-Shirts" },
  gildan_18500: { styleID: 395, brand: "Gildan", name: "18500", category: "Hoodies" },
  next_level_3600: { styleID: 3214, brand: "Next Level", name: "3600", category: "T-Shirts" },
  gildan_5400: { styleID: 17, brand: "Gildan", name: "5400", category: "Long Sleeve" },
  yupoong_6006: { styleID: 4118, brand: "Yupoong", name: "6006", category: "Headwear" },
  yupoong_6089M: { styleID: 4120, brand: "Yupoong", name: "6089M", category: "Headwear" },
};

export function searchStyles(q: { styleName?: string; brandName?: string; category?: string } = {}) {
  const p = new URLSearchParams();
  if (q.styleName) p.set("styleName", q.styleName);
  if (q.brandName) p.set("brandName", q.brandName);
  if (q.category) p.set("category", q.category);
  const qs = p.toString();
  return ssFetch<SSStyle[]>(`/styles${qs ? `?${qs}` : ""}`);
}

export function productsByStyle(styleID: number | string) {
  return ssFetch<SSProduct[]>(`/products?styleID=${encodeURIComponent(String(styleID))}`);
}

/** Flat front/back photo URLs for a style+color (S&S serves images at cdn.ssactivewear.com). */
export async function photosFor(styleID: number | string, colorName: string) {
  const products = await productsByStyle(styleID);
  const p = products.find((x) => x.colorName.toLowerCase() === colorName.toLowerCase());
  const abs = (u?: string) => (u ? (u.startsWith("http") ? u : `https://cdn.ssactivewear.com/${u}`) : null);
  return p ? { front: abs(p.colorFrontImage), back: abs(p.colorBackImage), side: abs(p.colorSideImage) } : null;
}

export async function findSku(styleID: number | string, color: string, size: string) {
  const products = await productsByStyle(styleID);
  return products.find((p) => p.colorName.toLowerCase() === color.toLowerCase() && p.sizeName.toUpperCase() === size.toUpperCase()) ?? null;
}

export interface SSOrderRequest {
  shippingAddress: { customer: string; attn?: string; address: string; city: string; state: string; zip: string };
  shippingMethod: string;      // e.g. "1" ground
  poNumber: string;
  emailConfirmation: string;
  testOrder?: boolean;
  autoselectWarehouse?: boolean;
  lines: Array<{ identifier: string; qty: number }>;
}

/**
 * Place a PO with S&S. Hard gate: only when LIVE_MONEY=true. Otherwise returns a
 * dry-run so the dashboard can show exactly what would be sent.
 */
export async function placeOrder(req: SSOrderRequest): Promise<{ placed: boolean; dryRun?: true; response?: unknown }> {
  if (!moneyIsLive()) return { placed: false, dryRun: true, response: { ...req, testOrder: true } };
  const response = await ssFetch<unknown>("/orders/", { method: "POST", body: JSON.stringify({ ...req, testOrder: req.testOrder ?? false, autoselectWarehouse: req.autoselectWarehouse ?? true }) });
  return { placed: true, response };
}
