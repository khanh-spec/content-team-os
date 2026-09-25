import { cookies } from "next/headers";
import { z } from "zod";
import { PREVIEW_SETTINGS_COOKIE, loadAiSettings } from "@/lib/ai";
import { HttpError, handle, parseBody, requireUser } from "@/lib/api";
import { encrypt } from "@/lib/crypto";
import { PREVIEW } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const Body = z.object({
  enabled: z.boolean(),
  model: z.string().trim().min(1).max(100),
  apiKey: z.string().trim().max(300).optional(),
  clearKey: z.boolean().optional(),
});

export const GET = handle(async () => {
  const { supabase } = await requireUser();
  const { key: _key, ...settings } = await loadAiSettings(supabase);
  void _key;
  return settings;
});

export const PUT = handle(async (req) => {
  const { supabase } = await requireUser();
  const { enabled, model, apiKey, clearKey } = await parseBody(req, Body);

  if (PREVIEW) {
    // No database in preview: remember the choice in a cookie.
    (await cookies()).set(PREVIEW_SETTINGS_COOKIE, JSON.stringify({ enabled, model }), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    if (apiKey) throw new HttpError(400, "Preview mode can't store API keys. The key saved on the server (Vercel) is used instead.");
    return { ok: true };
  }

  const { error } = await supabase.from("workspace_settings").upsert({ id: 1, ai_enabled: enabled, openai_model: model, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);

  if (apiKey || clearKey) {
    const admin = createAdminClient();
    if (!admin) throw new HttpError(400, "Storing an API key needs SUPABASE_SERVICE_ROLE_KEY on the server. The environment key is used instead.");
    const { error: e } = await admin
      .from("workspace_secrets")
      .upsert({ id: 1, openai_key_encrypted: clearKey ? null : encrypt(apiKey!), updated_at: new Date().toISOString() });
    if (e) throw new Error(e.message);
  }
  return { ok: true };
});
