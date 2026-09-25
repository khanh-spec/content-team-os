import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PREVIEW_MESSAGE } from "@/lib/demo/client";
import { PREVIEW, SUPABASE_KEY, SUPABASE_URL, isEmailAllowed } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/auth", "/api/auth"];

// In preview these run live (SerpApi / OpenAI) and return results without saving.
const PREVIEW_ALLOWED = [
  /^\/api\/settings$/,
  /^\/api\/projects\/[^/]+\/(research|briefs|drafts|serp-analysis|opportunities|extract|feedback\/extract)$/,
];

export async function proxy(request: NextRequest) {
  // Preview mode (no Supabase): browse the sample workspace, but block every
  // write so nothing pretends to save and no API credits are spent.
  if (PREVIEW) {
    const path = request.nextUrl.pathname;
    if (path.startsWith("/api/") && request.method !== "GET" && !PREVIEW_ALLOWED.some((re) => re.test(path))) {
      return NextResponse.json({ error: PREVIEW_MESSAGE }, { status: 403 });
    }
    return NextResponse.next();
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
