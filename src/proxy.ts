import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, isEmailAllowed } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/auth"];

export async function proxy(request: NextRequest) {
  // Without Supabase settings nothing works; show the setup checklist instead
  // of crashing every request.
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    if (request.nextUrl.pathname === "/setup") return NextResponse.next();
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Supabase is not configured. See /setup" }, { status: 503 });
    }
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Refreshes the session cookie when needed. Do not add logic between
  // client creation and this call.
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  const signedIn = !!data?.claims && isEmailAllowed(email);

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!signedIn && !isPublic) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = data?.claims ? "?error=domain" : "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
