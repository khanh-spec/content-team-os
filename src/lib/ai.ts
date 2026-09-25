import "server-only";

import OpenAI from "openai";
import { cookies } from "next/headers";
import { HttpError, type Supabase } from "@/lib/api";
import { decrypt } from "@/lib/crypto";
import { MODELS, PREVIEW } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const MODEL_OPTIONS = [
  { value: "gpt-5.5", label: "GPT-5.5" },
  { value: "gpt-5", label: "GPT-5" },
  { value: "gpt-4.1", label: "GPT-4.1" },
] as const;

export const PREVIEW_SETTINGS_COOKIE = "hop_ai";

export type AiSettings = {
  enabled: boolean;
  model: string;
  keySource: "workspace" | "environment" | "none";
  canStoreKey: boolean;
};

/** AI Enhanced mode handle. `null` everywhere means Free Intelligence mode. */
export type AI = {
  client: OpenAI;
  /** Writing, rewriting, synthesis. */
  model: string;
  /** Extraction and fan-outs. */
  fast: string;
};

async function storedKey(): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("workspace_secrets").select("openai_key_encrypted").eq("id", 1).maybeSingle();
  if (!data?.openai_key_encrypted) return null;
  try {
    return decrypt(data.openai_key_encrypted);
  } catch {
    return null;
  }
}

export async function loadAiSettings(supabase: Supabase): Promise<AiSettings & { key: string | null }> {
  let enabled = true;
  let model: string = MODELS.writer;
  if (PREVIEW) {
    const raw = (await cookies()).get(PREVIEW_SETTINGS_COOKIE)?.value;
    try {
      const parsed = raw ? (JSON.parse(raw) as { enabled?: boolean; model?: string }) : {};
      enabled = parsed.enabled ?? true;
      model = parsed.model || model;
    } catch {}
  } else {
    const { data } = await supabase.from("workspace_settings").select("ai_enabled, openai_model").eq("id", 1).maybeSingle();
    if (data) {
      enabled = data.ai_enabled;
      model = data.openai_model || model;
    }
  }
  const workspaceKey = await storedKey();
  const key = workspaceKey ?? process.env.OPENAI_API_KEY ?? null;
  return {
    enabled,
    model,
    key,
    keySource: workspaceKey ? "workspace" : process.env.OPENAI_API_KEY ? "environment" : "none",
    canStoreKey: !!createAdminClient(),
  };
}

/** Returns an AI handle when AI Enhanced mode is on and a key exists, else null. */
export async function getAI(supabase: Supabase): Promise<AI | null> {
  const s = await loadAiSettings(supabase);
  if (!s.enabled || !s.key) return null;
  return {
    client: new OpenAI({ apiKey: s.key }),
    model: s.model,
    fast: process.env.OPENAI_FAST_MODEL || s.model,
  };
}

export async function embed(ai: AI, texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 96) {
    const batch = texts.slice(i, i + 96).map((t) => t.slice(0, 8000));
    const res = await ai.client.embeddings.create({ model: MODELS.embedding, input: batch });
    out.push(...res.data.map((d) => d.embedding));
  }
  return out;
}

export const AI_REQUIRED_MESSAGE =
  "This needs AI Enhanced mode. Turn on OpenAI in Settings (and make sure an API key is set).";

/** For features that only exist in AI Enhanced mode. */
export async function requireAI(supabase: Supabase): Promise<AI> {
  const ai = await getAI(supabase);
  if (!ai) throw new HttpError(400, AI_REQUIRED_MESSAGE);
  return ai;
}
