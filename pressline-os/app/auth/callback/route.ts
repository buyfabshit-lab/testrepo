import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

/** Magic-link / OAuth callback: exchange the code server-side, then land on `next`. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nextPath = url.searchParams.get("next") ?? "/app";
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/app";
  if (code) {
    const supa = await serverClient();
    const { error } = await supa.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
  }
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
