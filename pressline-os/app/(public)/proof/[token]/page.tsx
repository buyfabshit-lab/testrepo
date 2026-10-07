import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase/service";
import { signedUrls } from "@/lib/supabase/storage";
import { CONSENT_TEXT } from "@/lib/sms";
import { STATUS_COLORS, STATUS_LABELS, isOrderStatus } from "@/lib/orders/status";
import type { BlankRow, CustomerRow, DesignRow, InvoiceRow, OrderLineRow, OrderRow, QuoteRow } from "@/lib/supabase/types";
import { ProofActions } from "@/components/studio/ProofActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Proof" };

type ProofLine = OrderLineRow & { blank: BlankRow | null; design: DesignRow | null };
type ProofOrder = OrderRow & {
  customer: CustomerRow | null;
  quote: QuoteRow | null;
  lines: ProofLine[];
  invoices: InvoiceRow[];
};

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "OS"];

function sizesOf(sizes: unknown): Array<[string, number]> {
  if (!sizes || typeof sizes !== "object" || Array.isArray(sizes)) return [];
  return Object.entries(sizes as Record<string, unknown>)
    .map(([k, v]) => [k, Number(v) || 0] as [string, number])
    .filter(([, n]) => n > 0)
    .sort((a, b) => {
      const ia = SIZE_ORDER.indexOf(a[0].toUpperCase()), ib = SIZE_ORDER.indexOf(b[0].toUpperCase());
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
}

const money = (n: number | null | undefined) => `$${(Number(n) || 0).toFixed(2)}`;

export default async function ProofPage({
  params, searchParams,
}: { params: Promise<{ token: string }>; searchParams: Promise<{ paid?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  if (!token || token.length < 8) notFound();

  const { data } = await db()
    .from("orders")
    .select("*, customer:customers(*), quote:quotes(*), lines:order_lines(*, blank:blanks(*), design:designs(*)), invoices(*)")
    .eq("proof_token", token)
    .maybeSingle();
  // Relationships are hand-typed as [] in lib/supabase/types, so the embed shape is asserted here.
  const order = data as unknown as ProofOrder | null;
  if (!order) notFound();

  const lines = order.lines ?? [];
  const invoices = order.invoices ?? [];
  const paidInvoice = invoices.find((i) => i.paid_at);
  const status = isOrderStatus(order.status) ? order.status : "NEW";
  const paid = Boolean(paidInvoice) || ["PAID", "BLANKS_ORDERED", "ART_READY", "ON_GANG_SHEET", "PRINTED", "PACKED", "SHIPPED", "DONE"].includes(status);
  const approved = lines.some((l) => l.design?.approved_at) || ["APPROVED"].includes(status) || paid;

  // Mockups: the design print files, signed for an hour. A private bucket → signed URLs only (spec §5).
  const paths = lines.map((l) => l.design?.print_file_path).filter((p): p is string => Boolean(p));
  const urls = await signedUrls(paths, 3600).catch(() => ({} as Record<string, string>));
  const mockups = lines.flatMap((l) => {
    const p = l.design?.print_file_path;
    if (!p || !urls[p]) return [];
    return (l.locations?.length ? l.locations : ["front"]).map((loc) => ({ key: `${l.id}-${loc}`, loc, url: urls[p], name: l.design?.file_name ?? null }));
  });

  const total = Number(order.quote?.total ?? lines.reduce((s, l) => s + (Number(l.unit_price) || 0) * sizesOf(l.sizes).reduce((a, [, n]) => a + n, 0), 0));
  const qty = lines.reduce((s, l) => s + sizesOf(l.sizes).reduce((a, [, n]) => a + n, 0), 0);
  const color = STATUS_COLORS[status];

  return (
    <section className="mx-auto max-w-4xl px-4 py-8">
      {sp.paid === "1" && (
        <div className="mb-6 border border-[color:var(--mf-ok)] bg-[color:var(--mf-ok)]/10 p-4">
          <p className="font-display text-xl uppercase text-mf-cream">Paid. You&apos;re on the board.</p>
          <p className="mt-1 text-sm text-mf-muted">We&apos;ll text or email you when it ships. This page stays live for your records.</p>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[.3em] text-mf-muted">Proof</p>
          <h1 className="mt-1 text-4xl text-mf-gold">Order #{order.number}</h1>
          {order.customer?.name && <p className="mt-1 text-sm text-mf-muted">for {order.customer.name}{order.customer.company ? ` · ${order.customer.company}` : ""}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="badge" style={{ background: color.hex, color: color.text }}>{STATUS_LABELS[status]}</span>
          <span className={`badge ${paid ? "bg-[color:var(--mf-ok)] text-white" : "border border-mf-line text-mf-muted"}`}>{paid ? "Paid" : "Unpaid"}</span>
          {order.rush && <span className="badge bg-mf-blood text-mf-cream">Rush</span>}
        </div>
      </div>

      {/* Mockups */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {mockups.length ? mockups.map((m) => (
          <figure key={m.key} className="panel p-3">
            <div className="flex aspect-square items-center justify-center bg-mf-bg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={`${m.loc} print`} className="max-h-full max-w-full object-contain" />
            </div>
            <figcaption className="mt-2 flex justify-between text-[11px] uppercase tracking-widest text-mf-muted">
              <span>{m.loc}</span>{m.name && <span className="font-mono normal-case tracking-normal text-mf-dim">{m.name}</span>}
            </figcaption>
          </figure>
        )) : (
          <div className="panel p-6 text-sm text-mf-muted sm:col-span-2">Art is still being prepped — the mockups land here as soon as it&apos;s cut.</div>
        )}
      </div>

      {/* Lines + sizes */}
      <div className="panel mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-widest text-mf-muted">
            <tr className="border-b border-mf-line">
              <th className="p-3">Blank</th><th className="p-3">Locations</th><th className="p-3">Sizes</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Unit</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const sz = sizesOf(l.sizes);
              const n = sz.reduce((a, [, c]) => a + c, 0);
              return (
                <tr key={l.id} className="border-b border-mf-line/60 align-top">
                  <td className="p-3">
                    <div className="text-mf-cream">{l.blank ? `${l.blank.brand ?? ""} ${l.blank.style ?? ""}`.trim() || "Blank" : "Blank"}</div>
                    <div className="text-xs text-mf-dim">{l.blank?.color ?? ""}{l.design?.method ? ` · ${l.design.method.toUpperCase()}` : ""}</div>
                  </td>
                  <td className="p-3 text-mf-muted">{(l.locations ?? []).join(", ") || "front"}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {sz.map(([s, c]) => <span key={s} className="border border-mf-line px-1.5 py-0.5 font-mono text-xs">{s}×{c}</span>)}
                    </div>
                  </td>
                  <td className="p-3 text-right font-mono">{n}</td>
                  <td className="p-3 text-right font-mono">{l.unit_price != null ? money(l.unit_price) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="p-3 text-xs uppercase tracking-widest text-mf-muted" colSpan={3}>{qty} pieces{order.due_date ? ` · due ${order.due_date}` : ""}</td>
              <td className="p-3 text-right text-xs uppercase tracking-widest text-mf-muted">Total</td>
              <td className="p-3 text-right font-mono text-lg text-mf-gold">{money(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ProofActions
        token={token}
        approved={approved}
        paid={paid}
        total={total}
        phone={order.customer?.phone ?? null}
        smsConsented={Boolean(order.customer?.sms_consent_at) && !order.customer?.sms_opted_out_at}
        consentText={CONSENT_TEXT}
      />
    </section>
  );
}
