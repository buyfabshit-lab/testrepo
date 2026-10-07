import { bad, json, params, staffRoute } from "@/lib/api";
import { db } from "@/lib/supabase/service";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export const GET = staffRoute<Ctx>(undefined, async (_req, ctx) => {
  const { id } = await params(ctx);
  const { data, error } = await db().from("quotes").select("*, customer:customers(*), orders(id, number, status, proof_token)").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return bad("not found", 404);
  return json({ quote: data, customer: data.customer });
});
