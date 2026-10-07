import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json({ ok: true, app: "pressline-os", version: process.env.npm_package_version ?? "0.1.0", time: new Date().toISOString() });
}
