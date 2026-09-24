import { redirect } from "next/navigation";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

const CHECKS = [
  { name: "NEXT_PUBLIC_SUPABASE_URL", ok: () => !!SUPABASE_URL, hint: "Local: http://127.0.0.1:54321 (printed by npm run db:start)" },
  { name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ok: () => !!SUPABASE_KEY, hint: "The Publishable (or anon) key printed by npm run db:start" },
  { name: "OPENAI_API_KEY", ok: () => !!process.env.OPENAI_API_KEY, hint: "Needed for rewrites, research summaries and AI visibility" },
  { name: "SERPAPI_API_KEY", ok: () => !!process.env.SERPAPI_API_KEY, hint: "Needed for Local Research and AI Visibility" },
];

/** Shown when required environment variables are missing. */
export default function SetupPage() {
  if (SUPABASE_URL && SUPABASE_KEY) redirect("/");
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Setup needed</h1>
      <p className="mt-2 text-sm text-ink-600">
        The app is running, but it can&apos;t find its settings. Create a file called <code className="rounded bg-ink-100 px-1">.env.local</code> in the project folder
        (copy <code className="rounded bg-ink-100 px-1">.env.example</code>), fill in the values below, then stop and restart <code className="rounded bg-ink-100 px-1">npm run dev</code>.
      </p>
      <ul className="mt-6 space-y-3">
        {CHECKS.map((c) => (
          <li key={c.name} className="rounded-xl border border-ink-200 bg-white p-4">
            <p className="flex items-center gap-2 font-mono text-sm">
              <span className={c.ok() ? "text-emerald-600" : "text-red-600"}>{c.ok() ? "✓" : "✗"}</span>
              {c.name}
            </p>
            <p className="mt-1 text-xs text-ink-500">{c.hint}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
