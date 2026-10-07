#!/usr/bin/env node
// Validates n8n/workflows/*.json: parse, top-level shape, node fields, connection
// references, duplicate names, a trigger node, and Code-node JS syntax.
// Run from the app root:  node n8n/validate.mjs
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "workflows");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const TRIGGERS = new Set(["n8n-nodes-base.webhook", "n8n-nodes-base.scheduleTrigger", "n8n-nodes-base.manualTrigger"]);
const INBOUND = ["pressline/lead", "pressline/status", "pressline/upload", "pressline/design-saved", "pressline/published"];

const rows = [];
let failed = 0;
const seenPaths = new Map();

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const errors = [];
  let wf;
  try {
    wf = JSON.parse(readFileSync(join(dir, file), "utf8"));
  } catch (e) {
    rows.push({ file, name: "-", nodes: 0, edges: 0, trigger: "-", status: `PARSE ERROR: ${e.message}` });
    failed++;
    continue;
  }
  for (const k of ["name", "nodes", "connections", "settings", "active", "versionId"]) if (!(k in wf)) errors.push(`missing top-level ${k}`);
  if (wf.settings?.executionOrder !== "v1") errors.push("settings.executionOrder must be v1");
  if (wf.active !== false) errors.push("active must be false on export");
  if (file !== `${wf.name}.json`) errors.push(`file name != workflow name (${wf.name})`);

  const names = new Set();
  const ids = new Set();
  let trigger = "-";
  for (const n of wf.nodes ?? []) {
    for (const k of ["id", "name", "type", "typeVersion", "position", "parameters"]) if (!(k in n)) errors.push(`node ${n.name ?? "?"} missing ${k}`);
    if (names.has(n.name)) errors.push(`duplicate node name ${n.name}`);
    names.add(n.name);
    if (ids.has(n.id)) errors.push(`duplicate node id ${n.id}`);
    ids.add(n.id);
    if (!Array.isArray(n.position) || n.position.length !== 2 || !n.position.every(Number.isFinite)) errors.push(`node ${n.name}: bad position`);
    if (typeof n.typeVersion !== "number") errors.push(`node ${n.name}: typeVersion must be a number`);
    if (TRIGGERS.has(n.type)) trigger = n.type === "n8n-nodes-base.webhook" ? `webhook ${n.parameters.path}` : n.type.replace("n8n-nodes-base.", "");
    if (n.type === "n8n-nodes-base.webhook") {
      if (!n.webhookId) errors.push(`node ${n.name}: webhook needs webhookId`);
      if (n.parameters.httpMethod !== "POST") errors.push(`node ${n.name}: webhook must be POST`);
      if (n.parameters.responseMode !== "onReceived") errors.push(`node ${n.name}: webhook must respond immediately (onReceived)`);
      if (!n.parameters.options?.rawBody) errors.push(`node ${n.name}: webhook needs options.rawBody for HMAC verification`);
      const p = n.parameters.path;
      if (seenPaths.has(p)) errors.push(`webhook path ${p} also used by ${seenPaths.get(p)}`);
      seenPaths.set(p, file);
      if (INBOUND.includes(p) || p.startsWith("pressline/internal/")) {
        const next = wf.connections?.[n.name]?.main?.[0]?.map((c) => c.node) ?? [];
        const verifyReachable = next.some((nm) => nm === "Verify" || (wf.connections?.[nm]?.main?.[0] ?? []).some((c) => c.node === "Verify"));
        if (!verifyReachable) errors.push(`node ${n.name}: not followed by Verify within two hops`);
      }
    }
    if (n.type === "n8n-nodes-base.code") {
      try { new AsyncFunction("$input", "$", "$env", "$json", "require", "Buffer", n.parameters.jsCode); } catch (e) { errors.push(`node ${n.name}: jsCode syntax: ${e.message}`); }
    }
    if (n.type === "n8n-nodes-base.httpRequest" && /twilio/i.test(n.parameters.url ?? "")) errors.push(`node ${n.name}: direct Twilio call is forbidden (use the app's /api/sms/send)`);
    if (n.type === "n8n-nodes-base.shopify" || /shopify/i.test(n.type)) errors.push(`node ${n.name}: n8n Shopify node/credential is forbidden`);
    if (n.type === "n8n-nodes-base.httpRequest" && n.parameters.url?.includes("$json.url")) {
      const hasSig = (n.parameters.headerParameters?.parameters ?? []).some((h) => h.name === "X-Pressline-Signature");
      if (!hasSig) errors.push(`node ${n.name}: signed app call without X-Pressline-Signature header`);
      if (n.parameters.method !== "GET" && n.parameters.contentType !== "raw") errors.push(`node ${n.name}: signed POST must send the raw signed string (contentType raw)`);
    }
  }
  if (trigger === "-") errors.push("no trigger node");
  if (!names.has("Secrets")) errors.push("no Secrets node");

  let edges = 0;
  for (const [from, conn] of Object.entries(wf.connections ?? {})) {
    if (!names.has(from)) errors.push(`connection from unknown node ${from}`);
    for (const outputs of conn.main ?? []) for (const t of outputs ?? []) {
      edges++;
      if (!names.has(t.node)) errors.push(`connection ${from} -> unknown node ${t.node}`);
      if (t.type !== "main") errors.push(`connection ${from} -> ${t.node}: type must be main`);
    }
  }
  // every non-trigger node must have at least one inbound edge
  const targets = new Set(Object.values(wf.connections ?? {}).flatMap((c) => (c.main ?? []).flat()).map((t) => t?.node));
  for (const n of wf.nodes ?? []) if (!TRIGGERS.has(n.type) && !targets.has(n.name)) errors.push(`node ${n.name} is orphaned (no inbound connection)`);

  if (errors.length) failed++;
  rows.push({ file, name: wf.name, nodes: wf.nodes?.length ?? 0, edges, trigger, status: errors.length ? `FAIL: ${errors.join("; ")}` : "ok" });
}

const w = { file: 26, name: 22, nodes: 5, edges: 5, trigger: 40 };
const line = (r) => [r.file.padEnd(w.file), r.name.padEnd(w.name), String(r.nodes).padStart(w.nodes), String(r.edges).padStart(w.edges), r.trigger.padEnd(w.trigger), r.status].join("  ");
console.log(line({ file: "file", name: "workflow", nodes: "nodes", edges: "edges", trigger: "trigger", status: "status" }));
console.log("-".repeat(120));
for (const r of rows) console.log(line(r));
console.log("-".repeat(120));
console.log(`${rows.length} workflows, ${rows.length - failed} ok, ${failed} failed`);
process.exit(failed ? 1 : 0);
