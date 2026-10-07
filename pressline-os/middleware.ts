import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every /app request and bounces
 * anonymous visitors to /login?next=<original path>.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return toLogin(request, "env");

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    db: { schema: "pressline" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return toLogin(request);
  return response;
}

function toLogin(request: NextRequest, reason?: string) {
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  if (reason) login.searchParams.set("reason", reason);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/app/:path*"] };
