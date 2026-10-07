/**
 * Phase 1 smoke test against a RUNNING deployment (staging on Railway).
 * Walks: capture → quote → send → one-tap approve → proof → approve & pay (Stripe test).
 *
 *   PRESSLINE_URL=https://<staging> STAFF_EMAIL=... STAFF_PASSWORD=... npm run smoke:phase1
 *
 * Needs a staff user (role owner) in Supabase Auth + pressline.staff. Writes nothing you can't delete:
 * every row is tagged "smoke-phase1". Prints a transcript you can paste into docs/phase-proof/.
 */
import { createClient } from "@supabase/supabase-js";

const BASE = (process.env.PRESSLINE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

async function staffCookie(): Promise<string> {
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await supa.auth.signInWithPassword({ email: process.env.STAFF_EMAIL!, password: process.env.STAFF_PASSWORD! });
  if (error || !data.session) throw new Error(`staff sign-in failed: ${error?.message}`);
  // @supabase/ssr cookie format: sb-<ref>-auth-token = base64url JSON of the session
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  const value = "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url");
  return `sb-${ref}-auth-token=${value}`;
}

async function call(path: string, init: RequestInit & { cookie?: string } = {}) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { "content-type": "application/json", ...(init.cookie ? { cookie: init.cookie } : {}), ...(init.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  log(`${init.method ?? "GET"} ${path} → ${res.status}`, JSON.stringify(body).slice(0, 300));
  if (!res.ok) throw new Error(`${path} failed`);
  return body;
}

async function main() {
  const cookie = await staffCookie();
  const lead = await call("/api/capture", { method: "POST", body: JSON.stringify({ name: "Smoke Phase1", email: `smoke-phase1-${Date.now()}@pressline.local`, company: "smoke-phase1", source: "front_gate", niche: "moto", email_opt_in: true }) });
  const blanks = await call("/api/blanks?supplier=ss&style=5000", { cookie });
  const blankId = blanks.blanks?.[0]?.id ?? null;
  const quote = await call("/api/quotes", { method: "POST", cookie, body: JSON.stringify({ customer_id: lead.customer_id, lines: [{ blank_id: blankId, method: "dtf", sizes: { S: 4, M: 10, L: 6 }, locations: ["front"], colors: 1 }] }) });
  const sent = await call(`/api/quotes/${quote.quote.id}/send`, { method: "POST", cookie });
  const approved = await call(`/api/quotes/${quote.quote.id}/approve`, { method: "POST", cookie });
  const token = approved.proof_url.split("/").pop();
  await call(`/api/proof/${token}`);
  const pay = await call(`/api/proof/${token}/approve`, { method: "POST" });
  log("Stripe checkout (test mode):", pay.checkout_url ?? pay.note);
  const board = await call(`/api/orders?status=APPROVED`, { cookie });
  log(`APPROVED on board: ${board.orders?.length}`);
  log("Phase 1 smoke complete. Pay the checkout in Stripe test mode, then confirm the order shows PAID on /app/board.", sent.proof_url);
}
main().catch((e) => { console.error(e); process.exit(1); });
