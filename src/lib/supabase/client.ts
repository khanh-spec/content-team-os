"use client";

import { createBrowserClient } from "@supabase/ssr";
import { createPreviewClient } from "@/lib/demo/client";
import { PREVIEW, SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";

export function createClient() {
  if (PREVIEW) return createPreviewClient();
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}
