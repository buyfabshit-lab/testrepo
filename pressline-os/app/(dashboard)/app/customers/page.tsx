import type { Metadata } from "next";
import { db } from "@/lib/supabase/service";
import type { CustomerRow } from "@/lib/supabase/types";
import { Card, PageHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Badge, SmsConsent, YesNo } from "@/components/ui/Badge";
import { fmtDate } from "@/components/ui/format";

export const metadata: Metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  let query = db().from("customers").select("*").order("created_at", { ascending: false }).limit(200);
  if (term) {
    const like = `%${term.replace(/[%,]/g, " ")}%`;
    query = query.or(`name.ilike.${like},company.ilike.${like},email.ilike.${like},phone.ilike.${like}`);
  }
  const { data, error } = await query;
  const rows = data ?? [];

  return (
    <>
      <PageHeader title="Customers" subtitle={error ? error.message : `${rows.length} shown`} />
      <form className="mb-4 flex gap-2" action="/app/customers">
        <input name="q" className="input" placeholder="Search name, company, email, phone" defaultValue={term} />
        <button type="submit" className="btn">Search</button>
      </form>
      <Card>
        <DataTable<CustomerRow>
          rows={rows} rowKey={(c) => c.id} rowHref={(c) => `/app/customers/${c.id}`} empty="No customers match."
          columns={[
            { key: "n", header: "Name", render: (c) => (<><span className="font-bold">{c.name ?? "—"}</span>{c.company ? <span className="block text-xs text-mf-muted">{c.company}</span> : null}{c.vip ? <Badge tone="gold" className="ml-1">VIP</Badge> : null}</>) },
            { key: "e", header: "Contact", render: (c) => (<><span className="block">{c.email ?? ""}</span><span className="block text-xs text-mf-muted">{c.phone ?? ""}</span></>), hideSm: true },
            { key: "s", header: "Source", render: (c) => c.source ?? "—", hideSm: true },
            { key: "ni", header: "Niche", render: (c) => c.niche ?? "—", hideSm: true },
            { key: "em", header: "Email opt-in", render: (c) => <YesNo value={c.email_opt_in} /> },
            { key: "sm", header: "SMS", render: (c) => <SmsConsent c={c} /> },
            { key: "d", header: "Since", render: (c) => <span className="text-mf-muted">{fmtDate(c.created_at)}</span>, hideSm: true },
          ]}
        />
      </Card>
    </>
  );
}
