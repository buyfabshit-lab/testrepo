import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase/service";
import type { CustomerRow, QuoteRow } from "@/lib/supabase/types";
import { ApproveQuote } from "@/components/board/ApproveQuote";
import { lineTitle, quoteLines } from "@/components/board/quoteLines";

export const metadata: Metadata = { title: "Approve quote" };
export const dynamic = "force-dynamic";

type Q = QuoteRow & { customer: CustomerRow | null };

export default async function ApprovePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: quote } = await db().from("quotes").select("*, customer:customers(*)").eq("id", id).maybeSingle().overrideTypes<Q, { merge: false }>();
  if (!quote) notFound();
  const lines = quoteLines(quote.lines).map((l) => ({ title: lineTitle(l), qty: l.qty ?? 0, method: l.method ?? "", line: l.line ?? 0 }));
  return (
    <ApproveQuote quoteId={quote.id} total={Number(quote.total ?? 0)} status={quote.status}
      customer={quote.customer ? { name: quote.customer.name, company: quote.customer.company } : null} lines={lines} />
  );
}
