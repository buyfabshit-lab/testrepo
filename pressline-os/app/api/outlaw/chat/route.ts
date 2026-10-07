import { z } from "zod";
import { bad, clientIp, json, parse, rateLimit, route } from "@/lib/api";
import { currentStaff } from "@/lib/auth/staff";
import { chat } from "@/lib/outlaw";
import { db } from "@/lib/supabase/service";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const Body = z.object({ message: z.string().trim().min(1).max(1000), history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(20).optional(), token: z.string().optional() });

/** Staff → full tools. A customer with a proof token → customer audience, scoped question. */
export const POST = route(async (req) => {
  if (!rateLimit(`outlaw:${clientIp(req)}`, 30, 60_000)) return bad("slow down", 429);
  const b = await parse(req, Body);
  const staff = await currentStaff();
  if (staff) {
    const r = await chat({ message: b.message, audience: "staff", history: b.history });
    return json({ text: r.text, tools_used: r.toolsUsed });
  }
  if (!b.token) return bad("sign in or use a proof link", 401);
  const { data: order } = await db().from("orders").select("number").eq("proof_token", b.token).maybeSingle();
  if (!order) return bad("bad token", 401);
  const r = await chat({ message: `(Customer asking about their order #${order.number} ONLY. Do not discuss other orders.) ${b.message}`, audience: "customer", history: b.history });
  return json({ text: r.text, tools_used: r.toolsUsed });
});
