import { NextResponse } from "next/server";
import { json, route } from "@/lib/api";
import { readSigned } from "@/lib/n8n/guard";
import { buildNightly } from "@/lib/gang";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
/** Nightly build — n8n-signed ONLY (spec §10). */
export const POST = route(async (req) => {
  const body = await readSigned<{ run_date?: string; max_height_in?: number; dry_run?: boolean }>(req);
  if (body instanceof NextResponse) return body;
  return json(await buildNightly({ runDate: body.run_date, maxHeightIn: body.max_height_in, dryRun: body.dry_run }));
});
