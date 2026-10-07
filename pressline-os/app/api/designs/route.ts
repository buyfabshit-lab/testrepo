import { z } from "zod";
import { bad, clientIp, json, parse, rateLimit, route } from "@/lib/api";
import { currentStaff } from "@/lib/auth/staff";
import { db } from "@/lib/supabase/service";
import { ensure300Dpi, estimateColors, info } from "@/lib/imaging";
import { printFileName, printFileStoragePath, DRIVE_FOLDERS, pacificDate } from "@/lib/naming";
import { putObject } from "@/lib/supabase/storage";
import { mirror } from "@/lib/drive";
import { logEvent } from "@/lib/orders/service";
import { postToN8n } from "@/lib/n8n/sign";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  customer_email: z.string().email().optional().nullable(),
  order_id: z.string().uuid().optional().nullable(),
  studio_json: z.unknown(),
  print_png_base64: z.string().min(100),
  width_in: z.number().positive().max(22),
  height_in: z.number().positive().max(100).optional(),
  method: z.enum(["screen", "dtf", "emb", "uv"]).default("dtf"),
  locations: z.array(z.string()).min(1).default(["front"]),
  brand: z.string().max(40).optional().nullable(),
  blank_id: z.string().uuid().optional().nullable(),
  blank_style: z.string().max(40).optional().nullable(),
  blank_brand: z.string().max(40).optional().nullable(),
  vault_asset_ids: z.array(z.string().uuid()).default([]),
});

/**
 * Save a studio design → designs row + 300 DPI print PNG + auto file name →
 * Storage AND Drive (rule 5). Staff, or anyone with an email (rate-limited).
 */
export const POST = route(async (req) => {
  const staff = await currentStaff();
  if (!staff && !rateLimit(`designs:${clientIp(req)}`, 10, 60_000)) return bad("slow down", 429);
  const b = await parse(req, Body);
  if (!staff && !b.customer_email && !b.customer_id) return bad("customer_email required", 422);

  let customerId = b.customer_id ?? null;
  if (!customerId && b.customer_email) {
    const email = b.customer_email.toLowerCase();
    const { data: c } = await db().from("customers").select("id").ilike("email", email).maybeSingle();
    customerId = c?.id ?? (await db().from("customers").insert({ email, source: "arcade" }).select("id").single()).data?.id ?? null;
  }

  const raw = Buffer.from(b.print_png_base64.replace(/^data:image\/\w+;base64,/, ""), "base64");
  const meta = await info(raw);
  if (!meta.width) return bad("bad image", 422);
  const { png, sourceDpi, upscaled, warning } = await ensure300Dpi(raw, b.width_in);
  const heightIn = b.height_in ?? Number(((meta.height / meta.width) * b.width_in).toFixed(2));
  const colors = b.method === "screen" ? await estimateColors(png).catch(() => null) : null;

  let orderNumber: number | null = null;
  if (b.order_id) orderNumber = (await db().from("orders").select("number").eq("id", b.order_id).maybeSingle()).data?.number ?? null;
  let blank = b.blank_id ? (await db().from("blanks").select("style, brand").eq("id", b.blank_id).maybeSingle()).data : null;
  blank = blank ?? (b.blank_style ? { style: b.blank_style, brand: b.blank_brand ?? null } : null);

  const fileName = printFileName({ orderNumber, brand: b.brand, blankStyle: blank?.style, blankBrand: blank?.brand, location: b.locations[0] });
  const storagePath = printFileStoragePath(orderNumber, fileName);
  await putObject(storagePath, png, "image/png");
  const drive = await mirror({ path: [DRIVE_FOLDERS.ARTWORK, orderNumber ? String(orderNumber) : "studio", pacificDate()], name: fileName, mimeType: "image/png", data: png }).catch((e) => { console.warn("[drive]", e); return null; });

  const { data: design, error } = await db().from("designs").insert({
    customer_id: customerId, vault_asset_ids: b.vault_asset_ids, studio_json: b.studio_json as never, print_file_path: storagePath, file_name: fileName,
    drive_file_id: drive?.id ?? null, method: b.method, colors, locations: b.locations, width_in: b.width_in, height_in: heightIn,
  }).select("*").single();
  if (error) throw new Error(error.message);

  await logEvent({ orderId: b.order_id ?? null, actor: staff ? (staff.name ?? staff.role) : "customer", kind: "design", msg: `Design saved ${fileName} (${sourceDpi} DPI source${upscaled ? ", upscaled" : ""})${drive ? "" : " — NOT in Drive"}`, data: { design_id: design.id, drive: drive?.id ?? null, warning: warning ?? null } });
  if (!staff && b.customer_email) void postToN8n("pressline/design-saved", { design_id: design.id, customer_id: customerId, email: b.customer_email, file_name: fileName, width_in: b.width_in, method: b.method });
  return json({ design, file_name: fileName, storage_path: storagePath, drive_file_id: drive?.id ?? null, dpi_warning: warning ?? null }, 201);
});
