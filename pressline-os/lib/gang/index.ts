import "server-only";
import sharp, { type OverlayOptions } from "sharp";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "@/lib/supabase/service";
import { getObject, putObject } from "@/lib/supabase/storage";
import { mirror, shareWith, driveConfigured, folderPath } from "@/lib/drive";
import { DRIVE_FOLDERS, pacificDate, sheetFileName } from "@/lib/naming";
import { GANG_SHEET, nest, pixelBox, type PrintItem, type SheetLayout } from "@/lib/nesting";
import { transition, logEvent } from "@/lib/orders/service";
import { say } from "@/lib/outlaw";
import { env } from "@/lib/env";
import { sendEmail, layout as emailLayout } from "@/lib/email";

/**
 * Nightly gang run (spec §7.7). Called by n8n at 00:00 America/Los_Angeles
 * through POST /api/gang-runs/build (HMAC-signed).
 */
export interface RunResult { runDate: string; sheets: Array<{ file: string; heightIn: number; prints: number }>; designs: number; orders: number; skipped?: string }

type LineWithDesign = { id: string; sizes: unknown; locations: string[] | null; design: { id: string; print_file_path: string | null; width_in: number | null; height_in: number | null; file_name: string | null } | null };
type OrderWithLines = { id: string; number: number; lines: LineWithDesign[] | null };

export async function buildNightly(opts: { runDate?: string; maxHeightIn?: number; dryRun?: boolean } = {}): Promise<RunResult> {
  const runDate = opts.runDate ?? pacificDate();
  const { data: existing } = await db().from("gang_runs").select("id").eq("run_date", runDate).maybeSingle();
  if (existing && !opts.dryRun) return { runDate, sheets: [], designs: 0, orders: 0, skipped: "already ran tonight" };

  const { data, error } = await db().from("orders").select("id, number, lines:order_lines(id, sizes, locations, design:designs(id, print_file_path, width_in, height_in, file_name))").eq("status", "ART_READY");
  if (error) throw new Error(error.message);
  const orders = (data ?? []) as unknown as OrderWithLines[];

  const items: PrintItem[] = [];
  const designIds = new Set<string>();
  const pathByDesign = new Map<string, string>();
  for (const o of orders) {
    for (const l of o.lines ?? []) {
      const d = l.design;
      if (!d?.print_file_path || !d.width_in || !d.height_in) continue;
      const qty = Object.values((l.sizes as Record<string, number> | null) ?? {}).reduce((s, n) => s + (Number(n) || 0), 0) || 1;
      const locs = l.locations?.length ? l.locations : ["front"];
      for (const loc of locs) for (let i = 0; i < qty; i++) items.push({ id: `${l.id}:${loc}:${i}`, designId: d.id, orderId: o.id, widthIn: Number(d.width_in), heightIn: Number(d.height_in), location: loc });
      designIds.add(d.id);
      pathByDesign.set(d.id, d.print_file_path);
    }
  }
  if (!items.length) {
    const r: RunResult = { runDate, sheets: [], designs: 0, orders: 0, skipped: "nothing ART_READY" };
    if (!opts.dryRun) {
      await db().from("gang_runs").insert({ run_date: runDate, sheet_files: [], design_ids: [], report: r.skipped });
      await say(null, "Midnight run's done. Nothing hit the press — nothing was ART_READY.");
    }
    return r;
  }

  const layouts = nest(items, { maxHeightIn: opts.maxHeightIn });
  const artCache = new Map<string, Buffer>();
  const art = async (designId: string) => {
    const hit = artCache.get(designId);
    if (hit) return hit;
    const buf = await getObject(pathByDesign.get(designId)!);
    artCache.set(designId, buf);
    return buf;
  };

  const sheetFiles: string[] = [];
  const out: RunResult["sheets"] = [];
  const driveFolder = driveConfigured() && !opts.dryRun ? await folderPath([DRIVE_FOLDERS.PRINT_READY_OUT, runDate]).catch(() => null) : null;
  for (const layout of layouts) {
    const png = await renderSheet(layout, art);
    const name = sheetFileName(runDate, layout.sheetNumber);
    const path = `gang-sheets/${runDate}/${name}`;
    if (!opts.dryRun) {
      await putObject(path, png, "image/png");
      await mirror({ path: [DRIVE_FOLDERS.PRINT_READY_OUT, runDate], name, mimeType: "image/png", data: png }).catch((e) => console.warn("[drive]", e));
      const packing = await packingList(name, layout, orders);
      await putObject(path.replace(/\.png$/, "_packing-list.pdf"), packing, "application/pdf");
      await mirror({ path: [DRIVE_FOLDERS.PRINT_READY_OUT, runDate], name: name.replace(/\.png$/, "_packing-list.pdf"), mimeType: "application/pdf", data: packing }).catch(() => null);
    }
    sheetFiles.push(path);
    out.push({ file: path, heightIn: layout.heightInches, prints: layout.printCount });
  }

  const orderIds = Array.from(new Set(items.map((i) => i.orderId!)));
  if (!opts.dryRun) {
    // Jeff gets one 4×6 tag per order: what's on tonight's sheets for it, sizes, and where it ships.
    for (const oid of orderIds) {
      try {
        const tag = await orderTag(oid, runDate);
        if (!tag) continue;
        const name = `${tag.number}-TAG-${runDate.replace(/-/g, "")}.pdf`;
        await putObject(`gang-sheets/${runDate}/tags/${name}`, tag.pdf, "application/pdf");
        await mirror({ path: [DRIVE_FOLDERS.PRINT_READY_OUT, runDate, "tags"], name, mimeType: "application/pdf", data: tag.pdf }).catch(() => null);
      } catch (e) { console.warn("[gang] tag", e); }
    }
  }
  const film = layouts.reduce((s, l) => s + l.heightInches, 0);
  const report = `${runDate}: ${items.length} print(s) on ${layouts.length} sheet(s), ${film}" of film, ${orderIds.length} order(s).`;
  if (!opts.dryRun) {
    await db().from("gang_runs").insert({ run_date: runDate, sheet_files: sheetFiles, design_ids: Array.from(designIds), report, sent_to_danny_at: driveFolder ? new Date().toISOString() : null });
    for (const id of orderIds) await transition(id, "ON_GANG_SHEET", { actor: "outlaw", reason: `midnight run ${runDate}` }).catch((e) => console.warn("[gang] transition", e));
    if (driveFolder && env.dannyEmail()) await shareWith(driveFolder, env.dannyEmail()).catch(() => null);
    if (env.dannyEmail()) {
      await sendEmail({ to: env.dannyEmail(), subject: `Midnight run ${runDate} — ${layouts.length} sheet(s)`, html: emailLayout("Tonight's gang sheets", `<p>${report}</p><p>Files are in Drive → FUSION INTAKE → ${DRIVE_FOLDERS.PRINT_READY_OUT} → ${runDate}.</p>`) }).catch(() => null);
    }
    await say(null, `Midnight run's done. ${items.length} print${items.length === 1 ? "" : "s"} on ${layouts.length} gang sheet${layouts.length === 1 ? "" : "s"}, ${film}" of film. Danny, they're in ${DRIVE_FOLDERS.PRINT_READY_OUT}.`, { runDate, sheets: sheetFiles });
    await logEvent({ actor: "system", kind: "gang_run", msg: report, data: { runDate, sheets: sheetFiles, orders: orderIds } });
  }
  return { runDate, sheets: out, designs: designIds.size, orders: orderIds.length };
}

export async function renderSheet(layout: SheetLayout, art: (designId: string) => Promise<Buffer>): Promise<Buffer> {
  const dpi = GANG_SHEET.DPI;
  const width = Math.round(layout.widthInches * dpi), height = Math.max(1, Math.round(layout.heightInches * dpi));
  const overlays: OverlayOptions[] = [];
  for (const p of layout.placements) {
    const box = pixelBox(p, dpi);
    let input = await art(p.designId);
    const meta = await sharp(input).metadata();
    if (meta.width !== box.width || meta.height !== box.height) input = await sharp(input).resize(box.width, box.height, { fit: "fill" }).png().toBuffer();
    if (box.left + box.width > width || box.top + box.height > height) {
      input = await sharp(input).extract({ left: 0, top: 0, width: Math.min(box.width, width - box.left), height: Math.min(box.height, height - box.top) }).png().toBuffer();
    }
    overlays.push({ input, left: box.left, top: box.top });
  }
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }, limitInputPixels: false })
    .composite(overlays).withMetadata({ density: dpi }).png({ compressionLevel: 6 }).toBuffer();
}

/** Packing list stamped "Packed under Outlaw's watch" (spec §7.8). */
export async function packingList(sheetName: string, layout: SheetLayout, orders: Array<{ id: string; number: number }>): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]);
  let y = 752;
  const t = (s: string, x: number, size = 10, f = font) => { page.drawText(s, { x, y, size, font: f, color: rgb(0, 0, 0) }); };
  t(`Midnight Fusion — Gang sheet ${sheetName}`, 40, 16, bold); y -= 20;
  t(`${layout.widthInches}" x ${layout.heightInches}" - ${layout.printCount} prints - ${layout.utilizationPct}% used`, 40); y -= 24;
  const byOrder = new Map<string, number>();
  for (const p of layout.placements) byOrder.set(p.orderId ?? "?", (byOrder.get(p.orderId ?? "?") ?? 0) + 1);
  t("Order", 40, 10, bold); t("Prints", 200, 10, bold); y -= 14;
  for (const [oid, n] of byOrder) { const num = orders.find((o) => o.id === oid)?.number ?? "?"; t(`#${num}`, 40); t(String(n), 200); y -= 13; }
  y -= 20;
  t("Packed under Outlaw's watch.", 40, 11, bold);
  return Buffer.from(await pdf.save());
}

/** 4×6 in packing tag per order for Jeff (spec §7.7): number, customer, lines + sizes, ship-to, Outlaw stamp. */
export async function orderTag(orderId: string, runDate: string): Promise<{ number: number; pdf: Buffer } | null> {
  const { data: o } = await db().from("orders").select("number, due_date, rush, customer:customers(name, company, address), lines:order_lines(sizes, locations, blank:blanks(style, brand, color), design:designs(file_name))").eq("id", orderId).maybeSingle();
  if (!o) return null;
  type L = { sizes: Record<string, number> | null; locations: string[] | null; blank: { style: string | null; brand: string | null; color: string | null } | null; design: { file_name: string | null } | null };
  const lines = ((o.lines ?? []) as unknown as L[]);
  const cust = o.customer as unknown as { name: string | null; company: string | null; address: Record<string, string> | null } | null;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 288, H = 432, M = 18;
  const page = pdf.addPage([W, H]);
  let y = H - M - 4;
  const t = (s: string, size = 9, f = font, x = M) => { page.drawText(s.slice(0, 60), { x, y, size, font: f, color: rgb(0, 0, 0) }); y -= size + 4; };
  t(`#${o.number}`, 26, bold);
  t(`${cust?.company ?? cust?.name ?? "—"}${o.rush ? "   RUSH" : ""}`, 11, bold);
  t(`Run ${runDate}${o.due_date ? ` · due ${o.due_date}` : ""}`, 8); y -= 4;
  for (const l of lines) {
    const sizes = Object.entries(l.sizes ?? {}).filter(([, n]) => Number(n) > 0).map(([k, n]) => `${k}×${n}`).join(" ");
    t(`${[l.blank?.brand, l.blank?.style, l.blank?.color].filter(Boolean).join(" ") || "blank TBD"} · ${(l.locations ?? ["front"]).join("+")}`, 9, bold);
    t(`${sizes || "sizes TBD"}`, 9);
    if (l.design?.file_name) t(l.design.file_name, 7);
    y -= 3;
  }
  const a = cust?.address;
  if (a) { y -= 4; t("SHIP TO", 8, bold); for (const line of [a.name ?? cust?.name ?? "", a.company ?? "", a.street1 ?? "", a.street2 ?? "", `${a.city ?? ""}, ${a.state ?? ""} ${a.postalCode ?? ""}`].filter((x) => x.trim() && x.trim() !== ",")) t(line, 9); }
  page.drawText("Packed under Outlaw's watch", { x: M, y: M, size: 8, font: bold, color: rgb(0.3, 0.3, 0.3) });
  return { number: o.number, pdf: Buffer.from(await pdf.save()) };
}
