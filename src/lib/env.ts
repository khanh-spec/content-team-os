// Central place for environment configuration. Server-only values are read
// lazily so a missing key only breaks the feature that needs it.

// Supabase settings are server-only: the browser never talks to Supabase
// directly (sign-in and uploads go through our API), so no NEXT_PUBLIC_ vars
// are needed. The NEXT_PUBLIC_ names still work for older setups.
export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const MODELS = {
  // Brand-aware rewriting, fact-checking and synthesis.
  writer: process.env.OPENAI_WRITER_MODEL ?? "gpt-5.5",
  // Cheap structured extraction (mention parsing, fan-out generation).
  fast: process.env.OPENAI_FAST_MODEL ?? "gpt-5.4-mini",
  // Model used to simulate ChatGPT answers (with web search) for AI visibility.
  chatgpt: process.env.OPENAI_CHATGPT_MODEL ?? "gpt-5.5",
  embedding: "text-embedding-3-small",
} as const;

export function allowedEmailDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string | undefined | null): boolean {
  const domains = allowedEmailDomains();
  if (domains.length === 0) return true;
  const domain = email?.split("@")[1]?.toLowerCase();
  return !!domain && domains.includes(domain);
}

/** Preview mode: no Supabase configured, so the app serves a read-only sample workspace. */
export const PREVIEW = !SUPABASE_URL || !SUPABASE_KEY;
