import { NextResponse } from "next/server";
import { SIGNATURE_HEADER, verify } from "./sign";

/**
 * Read + verify a signed request body. Returns the parsed JSON, or a 401 response.
 * Usage:  const r = await readSigned(req); if (r instanceof NextResponse) return r;
 */
export async function readSigned<T = unknown>(req: Request): Promise<T | NextResponse> {
  const raw = await req.text();
  if (!verify(raw, req.headers.get(SIGNATURE_HEADER))) {
    return NextResponse.json({ error: "unsigned or stale request" }, { status: 401 });
  }
  try {
    return JSON.parse(raw || "{}") as T;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
}
