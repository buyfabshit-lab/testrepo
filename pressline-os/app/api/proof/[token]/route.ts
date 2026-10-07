import { bad, json, params, route } from "@/lib/api";
import { getOrderByProofToken } from "@/lib/orders/service";
import { signedUrls } from "@/lib/supabase/storage";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ token: string }> };

export const GET = route<Ctx>(async (_req, ctx) => {
  const { token } = await params(ctx);
  const order = await getOrderByProofToken(token);
  if (!order) return bad("not found", 404);
  const paths = (order.lines ?? []).map((l) => l.design?.print_file_path).filter((p): p is string => Boolean(p));
  const urls = await signedUrls(paths, 1800).catch(() => ({} as Record<string, string>));
  const paid = (order.invoices ?? []).some((i) => i.paid_at);
  return json({
    order: { id: order.id, number: order.number, status: order.status, due_date: order.due_date, rush: order.rush },
    customer: order.customer ? { name: order.customer.name, company: order.customer.company, email: order.customer.email, phone: order.customer.phone, sms_consent: Boolean(order.customer.sms_consent_at) } : null,
    lines: (order.lines ?? []).map((l) => ({ id: l.id, sizes: l.sizes, locations: l.locations, unit_price: l.unit_price, blank: l.blank, design: l.design ? { id: l.design.id, file_name: l.design.file_name, approved_at: l.design.approved_at, method: l.design.method, mockup_url: l.design.print_file_path ? urls[l.design.print_file_path] ?? null : null } : null })),
    mockups: Object.values(urls),
    total: order.quote?.total ?? null,
    paid,
    locked: (order.lines ?? []).some((l) => l.design?.approved_at),
  });
});
