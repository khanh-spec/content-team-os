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
    <div className="max-w-2xl px-4 py-8 sm:px-8">
      <h1 className="text-xl font-semibold">Connect Supabase to save work</h1>
      <p className="mt-2 text-sm text-ink-600">
        The app is running in <strong className="text-ink-900">preview mode</strong> with a sample workspace. To save projects, upload files and run AI research, add these settings:
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-600">
        <li>
          <strong className="text-ink-800">On Vercel:</strong> Project → Settings → Environment Variables, then redeploy.
        </li>
        <li>
          <strong className="text-ink-800">On your computer:</strong> in <code className="rounded bg-ink-100 px-1">.env.local</code> (copy <code className="rounded bg-ink-100 px-1">.env.example</code>), then restart <code className="rounded bg-ink-100 px-1">npm run dev</code>.
        </li>
      </ul>
      <p className="mt-3 text-sm text-ink-600">
        Create the database by running <code className="rounded bg-ink-100 px-1">supabase/migrations/0001_init.sql</code> in the Supabase SQL editor (or run <code className="rounded bg-ink-100 px-1">npm run db:start</code> locally).
      </p>
      <ul className="mt-6 space-y-3">
        {CHECKS.map((c) => (
          <li key={c.name} className="rounded-xl border border-ink-200 bg-surface p-4">
            <p className="flex items-center gap-2 font-mono text-sm">
              <span className={c.ok() ? "text-emerald-400" : "text-red-400"}>{c.ok() ? "✓" : "✗"}</span>
              {c.name}
            </p>
            <p className="mt-1 text-xs text-ink-500">{c.hint}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
