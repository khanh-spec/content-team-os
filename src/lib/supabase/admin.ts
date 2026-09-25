import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { PREVIEW, SUPABASE_URL } from "@/lib/env";

/** Service-role client for server-only secrets. Null when not configured. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (PREVIEW || !key) return null;
  return createSupabaseClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}
