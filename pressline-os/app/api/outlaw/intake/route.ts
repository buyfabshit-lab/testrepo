import { NextResponse } from "next/server";
import { z } from "zod";
import { bad, json, route } from "@/lib/api";
import { currentStaff } from "@/lib/auth/staff";
import { SIGNATURE_HEADER, verify } from "@/lib/n8n/sign";
import { classifyFile, say } from "@/lib/outlaw";
import { getObject } from "@/lib/supabase/storage";
import { mirror } from "@/lib/drive";
import { db } from "@/lib/supabase/service";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const Body = z.object({ order_id: z.string().uuid(), files: z.array(z.object({ name: z.string().min(1), mime: z.string().optional().nullable(), storage_path: z.string().min(1) })).min(1) });

/** Every new order's files → Outlaw classifies, routes to Drive FUSION INTAKE subfolders, logs, pings Jeff (spec §7.10). Staff OR n8n-signed. */
export const POST = route(async (req) => {
  const raw = await req.text();
  const signed = verify(raw, req.headers.get(SIGNATURE_HEADER));
  const staff = signed ? null : await currentStaff();
  if (!signed && !staff) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = Body.parse(JSON.parse(raw || "{}"));
  const { data: order } = await db().from("orders").select("id, number").eq("id", b.order_id).maybeSingle();
  if (!order) return bad("order not found", 404);
  const routed = [];
  for (const f of b.files) {
    const { cls, driveFolder } = classifyFile(f.name, f.mime);
    let driveId: string | null = null;
    try {
      const data = await getObject(f.storage_path);
      driveId = (await mirror({ path: [driveFolder, String(order.number)], name: f.name, mimeType: f.mime ?? "application/octet-stream", data }))?.id ?? null;
    } catch (e) { console.warn("[intake]", e); }
    routed.push({ name: f.name, class: cls, drive_folder: driveFolder, drive_file_id: driveId });
    await say(order.id, `Filed ${f.name} under ${cls}${driveId ? "" : " (Drive copy pending)"}.`, { file: f.name, class: cls, drive_file_id: driveId });
  }
  await say(order.id, `→ jeff: ${order.number} is in. ${routed.length} file${routed.length === 1 ? "" : "s"} sorted into FUSION INTAKE.`, { to: "jeff" });
  return json({ routed });
});
