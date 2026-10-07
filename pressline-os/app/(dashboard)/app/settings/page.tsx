import type { Metadata } from "next";
import { currentStaff } from "@/lib/auth/staff";
import { db } from "@/lib/supabase/service";
import { Card, PageHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { updateStaffRole } from "./actions";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/** Names only, grouped. Values are never read into the page — only whether they are set. */
const INTEGRATIONS: { group: string; keys: string[] }[] = [
  { group: "Supabase", keys: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_STORAGE_BUCKET"] },
  { group: "Stripe", keys: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] },
  { group: "Blanks", keys: ["SS_ACCOUNT_NUMBER", "SS_API_KEY", "SANMAR_DATA_URL"] },
  { group: "Storefronts", keys: ["SHOPIFY_DC_SHOP", "SHOPIFY_DC_CLIENT_ID", "SHOPIFY_DC_CLIENT_SECRET", "SKREWU_SUPABASE_URL", "SKREWU_SERVICE_KEY"] },
  { group: "Drive", keys: ["GOOGLE_SERVICE_ACCOUNT_JSON", "DRIVE_FUSION_INTAKE_ID"] },
  { group: "n8n", keys: ["N8N_BASE_URL", "N8N_WEBHOOK_SECRET"] },
  { group: "AI", keys: ["ANTHROPIC_API_KEY", "HEDRA_API_KEY"] },
  { group: "Email / SMS", keys: ["RESEND_API_KEY", "EMAIL_FROM", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_MESSAGING_SERVICE_SID"] },
  { group: "Shipping", keys: ["SHIPSTATION_API_KEY", "SHIPSTATION_API_SECRET"] },
  { group: "App", keys: ["OFFICE_PIN_HASH", "APP_SIGNING_SECRET", "NEXT_PUBLIC_APP_URL", "JUSTIN_EMAIL", "JEFF_EMAIL", "DANNY_EMAIL"] },
];
const ROLES = ["owner", "production", "print", "ship"] as const;
const flag = (k: string) => /^(1|true|yes|on)$/i.test(process.env[k] ?? "");

export default async function SettingsPage() {
  const me = await currentStaff();
  const isOwner = me?.role === "owner";
  const { data: staff } = await db().from("staff").select("id, name, role").order("name");
  const liveMoney = flag("LIVE_MONEY");
  const smsEnabled = flag("SMS_ENABLED");
  const status = INTEGRATIONS.map((g) => ({ ...g, items: g.keys.map((k) => ({ key: k, set: Boolean(process.env[k]) })) }));
  const missing = status.flatMap((g) => g.items).filter((i) => !i.set).length;

  return (
    <>
      <PageHeader title="Settings" subtitle="What is wired up, who is on staff, and the money switches. Values are never shown here." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className={`panel p-4 ${liveMoney ? "border-mf-blood" : ""}`}>
          <p className="label">LIVE_MONEY</p>
          <p className={`font-display text-3xl ${liveMoney ? "text-mf-blood" : "text-mf-muted"}`}>{liveMoney ? "ON — real POs, real charges" : "OFF — dry runs only"}</p>
        </div>
        <div className={`panel p-4 ${smsEnabled ? "border-mf-gold" : ""}`}>
          <p className="label">SMS_ENABLED</p>
          <p className={`font-display text-3xl ${smsEnabled ? "text-mf-gold" : "text-mf-muted"}`}>{smsEnabled ? "ON — Twilio sends" : "OFF — texts are logged, not sent"}</p>
          <p className="mt-1 text-xs text-mf-dim">Outbound SMS also needs LIVE_MONEY=true and a consented customer.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Integrations" className="lg:col-span-2" action={<span className="text-xs text-mf-muted">{missing} missing</span>}>
          <div className="grid gap-4 sm:grid-cols-2">
            {status.map((g) => (
              <div key={g.group}>
                <p className="label">{g.group}</p>
                <ul className="space-y-1 text-xs">
                  {g.items.map((i) => (
                    <li key={i.key} className="flex items-center justify-between gap-2 border-b border-mf-line/50 py-1">
                      <span className="font-mono text-mf-cream">{i.key}</span>
                      <Badge tone={i.set ? "ok" : "bad"}>{i.set ? "set" : "missing"}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Staff">
            <ul className="divide-y divide-mf-line text-sm">
              {(staff ?? []).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                  <span><span className="font-bold">{s.name ?? s.id.slice(0, 8)}</span>{s.id === me?.userId ? <span className="ml-1 text-xs text-mf-dim">(you)</span> : null}</span>
                  {isOwner ? (
                    <form action={updateStaffRole} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={s.id} />
                      <select name="role" defaultValue={s.role} className="input !w-auto !py-1 text-xs uppercase">
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button type="submit" className="btn !px-2 !py-1 !text-[.6rem]">Save</button>
                    </form>
                  ) : <Badge tone={s.role === "owner" ? "gold" : "muted"}>{s.role}</Badge>}
                </li>
              ))}
              {!staff?.length ? <li className="py-2 text-mf-dim">No staff rows. Insert into pressline.staff with the auth user id.</li> : null}
            </ul>
            <p className="mt-2 text-xs text-mf-dim">New staff: create the Supabase auth user, then add a row in pressline.staff with the same id. Owner only can change roles.</p>
          </Card>

          <Card title="Office PIN lock">
            <p className="text-sm text-mf-muted">The Business Office in the Clubhouse sits behind a PIN wall. The PIN is checked server-side at <span className="font-mono">POST /api/office/pin</span>, sets the httpOnly <span className="font-mono">pl_office</span> cookie, and locks out for 15 minutes after 3 failures.</p>
            <p className="mt-2 text-sm">OFFICE_PIN_HASH: <Badge tone={process.env.OFFICE_PIN_HASH ? "ok" : "bad"}>{process.env.OFFICE_PIN_HASH ? "set" : "missing"}</Badge></p>
            <p className="mt-1 text-xs text-mf-dim">Make one with <span className="font-mono">npm run pin:hash -- 1234</span> and put it in Railway.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
