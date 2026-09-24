import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createPreviewClient } from "@/lib/demo/client";
import { PREVIEW, SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";

export async function createClient() {
  if (PREVIEW) return createPreviewClient();
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component: the proxy refreshes sessions.
        }
      },
    },
  });
}
