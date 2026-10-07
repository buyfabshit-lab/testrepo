/**
 * Intake screen (port of screen.py + blocklist.json).
 *
 * A hit sets the order to HOLD and notifies Justin only. It never auto-rejects
 * silently and never tells the customer why.
 */
import blocklist from "./blocklist.json";

export interface ScreenInput {
  name?: string | null; email?: string | null; company?: string | null; phone?: string | null;
  notes?: string | null; designTitles?: string[]; tags?: string[]; website?: string | null;
}
export interface ScreenHit { category: string; term: string; field: string }
export interface ScreenResult { result: "pass" | "hold"; hits: ScreenHit[]; screenedAt: string }

type Lists = Record<string, string[] | string>;

function lists(): Array<[string, string[]]> {
  return Object.entries(blocklist as Lists)
    .filter(([k, v]) => !k.startsWith("_") && Array.isArray(v))
    .map(([k, v]) => [k, (v as string[]).map((t) => t.toLowerCase())]);
}

const DISPOSABLE_EMAIL = /@(mailinator|guerrillamail|10minutemail|tempmail|yopmail|trashmail)\./i;

export function screen(input: ScreenInput): ScreenResult {
  const fields: Array<[string, string]> = [
    ["name", input.name ?? ""], ["email", input.email ?? ""], ["company", input.company ?? ""],
    ["notes", input.notes ?? ""], ["website", input.website ?? ""],
    ["designTitles", (input.designTitles ?? []).join(" | ")], ["tags", (input.tags ?? []).join(" | ")],
  ];
  const hits: ScreenHit[] = [];
  for (const [category, terms] of lists()) {
    for (const [field, raw] of fields) {
      const hay = raw.toLowerCase();
      if (!hay) continue;
      for (const term of terms) if (term && hay.includes(term)) hits.push({ category, term, field });
    }
  }
  if (input.email && DISPOSABLE_EMAIL.test(input.email)) hits.push({ category: "disposable_email", term: "disposable", field: "email" });
  return { result: hits.length ? "hold" : "pass", hits, screenedAt: new Date().toISOString() };
}
