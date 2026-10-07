import "server-only";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { OUTLAW_TOOLS, runTool } from "./tools";
import { logEvent } from "@/lib/orders/service";
import { DRIVE_FOLDERS } from "@/lib/naming";

export const OUTLAW_MODEL = "claude-sonnet-5-5";

let personaCache: string | null = null;
export function persona(): string {
  if (personaCache) return personaCache;
  const file = path.join(process.cwd(), "lib/outlaw/persona.md");
  const md = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const m = md.match(/<!-- PERSONA:BEGIN -->([\s\S]*?)<!-- PERSONA:END -->/);
  const rules = md.split("## Hard rules")[1] ?? "";
  personaCache = `${(m?.[1] ?? "You are Outlaw, the dispatcher.").trim()}\n\nHARD RULES (these override everything above):\n${rules.trim()}\n\nIf the data doesn't say it, you say you don't know. Answer in 1–4 sentences unless listing.`;
  return personaCache;
}

export type Audience = "staff" | "customer";

/**
 * Outlaw chat: tool calls into the DB only. Loops until the model stops
 * calling tools (max 6 rounds). Returns the final text.
 */
export async function chat(input: { message: string; audience: Audience; history?: Array<{ role: "user" | "assistant"; content: string }> }): Promise<{ text: string; toolsUsed: string[] }> {
  const key = env.anthropicApiKey();
  if (!key) return { text: "Outlaw's radio is off (ANTHROPIC_API_KEY not set). Ask the dashboard directly.", toolsUsed: [] };
  const client = new Anthropic({ apiKey: key });
  const system = `${persona()}\n\nAUDIENCE: ${input.audience === "customer" ? "a customer — no internal costs, no supplier names, no other customers" : "shop staff"}.`;
  const messages: Anthropic.MessageParam[] = [
    ...(input.history ?? []).slice(-10).map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: input.message },
  ];
  const toolsUsed: string[] = [];
  for (let round = 0; round < 6; round++) {
    const res = await client.messages.create({
      model: OUTLAW_MODEL, max_tokens: 800, system, messages,
      tools: OUTLAW_TOOLS as unknown as Anthropic.Tool[],
    });
    const toolUses = res.content.filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !toolUses.length) {
      const text = res.content.filter((c): c is Anthropic.TextBlock => c.type === "text").map((c) => c.text).join("\n").trim();
      return { text: text || "Nothing in the log on that.", toolsUsed };
    }
    messages.push({ role: "assistant", content: res.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      toolsUsed.push(tu.name);
      const out = await runTool(tu.name, (tu.input ?? {}) as Record<string, unknown>).catch((e) => ({ error: String(e) }));
      results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out) });
    }
    messages.push({ role: "user", content: results });
  }
  return { text: "Lost the thread — ask me again, shorter.", toolsUsed };
}

/** File classification for intake (spec §7.10). Deterministic; no model call needed. */
export type IntakeClass = "Incoming" | "Art Files" | "Client Requests" | "Customer Files" | "Artwork" | "Vectors" | "Fonts";
export function classifyFile(name: string, mime?: string | null): { cls: IntakeClass; driveFolder: string } {
  const n = name.toLowerCase();
  const ext = n.split(".").pop() ?? "";
  if (["ttf", "otf", "woff", "woff2"].includes(ext)) return { cls: "Fonts", driveFolder: DRIVE_FOLDERS.FONTS };
  if (["ai", "eps", "svg", "pdf", "cdr"].includes(ext)) return { cls: "Vectors", driveFolder: DRIVE_FOLDERS.VECTORS };
  if (["psd", "tif", "tiff"].includes(ext)) return { cls: "Art Files", driveFolder: DRIVE_FOLDERS.ART_FILES };
  if (["png", "jpg", "jpeg", "webp", "gif", "heic"].includes(ext) || (mime ?? "").startsWith("image/")) return { cls: "Artwork", driveFolder: DRIVE_FOLDERS.ARTWORK };
  if (["txt", "doc", "docx", "md", "rtf"].includes(ext)) return { cls: "Client Requests", driveFolder: DRIVE_FOLDERS.CLIENT_REQUESTS };
  if (["xls", "xlsx", "csv", "zip"].includes(ext)) return { cls: "Customer Files", driveFolder: DRIVE_FOLDERS.CUSTOMER_FILES };
  return { cls: "Incoming", driveFolder: DRIVE_FOLDERS.INCOMING };
}

/** Outlaw says something into the log (and the intercom listens to events). */
export async function say(orderId: string | null, msg: string, data?: Record<string, unknown>) {
  await logEvent({ orderId, actor: "outlaw", kind: "outlaw", msg, data });
}

/** In-character ping lines for status changes. No invented facts: only what's passed in. */
export function pingFor(status: string, orderNumber: number, extra: { customer?: string | null; due?: string | null } = {}): { to: "jeff" | "danny" | "customer" | "justin"; text: string }[] {
  const who = extra.customer ? ` for ${extra.customer}` : "";
  const due = extra.due ? ` Due ${extra.due}.` : "";
  switch (status) {
    case "PAID": return [{ to: "jeff", text: `${orderNumber}${who} is paid. It's real now.${due}` }, { to: "justin", text: `${orderNumber} paid.` }];
    case "BLANKS_ORDERED": return [{ to: "jeff", text: `Blanks are on the way for ${orderNumber}. Watch the dock.` }];
    case "ART_READY": return [{ to: "danny", text: `Art for ${orderNumber} is named and in 01 TO GANG SHEET. It rides tonight.` }];
    case "ON_GANG_SHEET": return [{ to: "danny", text: `${orderNumber} is on tonight's sheet.` }, { to: "jeff", text: `${orderNumber} went to Danny.` }];
    case "PRINTED": return [{ to: "jeff", text: `Danny's done with ${orderNumber}. It's yours — pack it.` }];
    case "PACKED": return [{ to: "jeff", text: `${orderNumber} packed under my watch. Label next.` }];
    case "SHIPPED": return [{ to: "customer", text: `Your Midnight Fusion order #${orderNumber} is on its way.` }];
    case "HOLD": return [{ to: "justin", text: `${orderNumber} is on HOLD. Needs your eyes.` }];
    default: return [];
  }
}
