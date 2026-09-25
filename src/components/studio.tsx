"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/fetcher";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { OptimisationPanel } from "@/components/optimisation-panel";
import { Badge, Button, Card, ErrorNote, Field, Input, Select, Spinner, Textarea, cn } from "@/components/ui";
import type { DraftRow } from "@/lib/types";

export type RunOption = { id: string; kind: string; query: string; created_at: string };

export const CONTENT_TYPES = ["Blog article", "Landing page", "Room / suite page", "Local guide / listicle", "FAQ", "Meta title & description", "Social post", "Email", "Other"];

export function RunPicker({ runs, value, onChange }: { runs: RunOption[]; value: string[]; onChange: (ids: string[]) => void }) {
  if (!runs.length) return <p className="text-sm text-ink-500">No research runs yet. Run Local Research or AI Visibility to add customer and competitor context.</p>;
  return (
    <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-ink-200 p-2">
      {runs.map((r) => (
        <label key={r.id} className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm", value.includes(r.id) && "bg-brand-50")}>
          <input
            type="checkbox"
            checked={value.includes(r.id)}
            onChange={(e) => onChange(e.target.checked ? [...value, r.id].slice(-6) : value.filter((v) => v !== r.id))}
          />
          <Badge tone={r.kind === "local_context" ? "blue" : "violet"}>{r.kind === "local_context" ? "Local" : "AI vis."}</Badge>
          <span className="truncate">{r.query}</span>
        </label>
      ))}
    </div>
  );
}

export function NewDraftForm({ projectId, runs, aiEnabled, initial }: { projectId: string; runs: RunOption[]; aiEnabled: boolean; initial?: { title?: string; target_keyword?: string; instructions?: string } }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    content_type: "Blog article",
    target_keyword: initial?.target_keyword ?? "",
    original_content: "",
    instructions: initial?.instructions ?? "",
    compare_serp: true,
    ai_rewrite: aiEnabled,
    live_check: false,
  });
  const [runIds, setRunIds] = useState<string[]>(runs.slice(0, 2).map((r) => r.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inline, setInline] = useState<DraftRow | null>(null);
  const words = form.original_content.trim() ? form.original_content.trim().split(/\s+/).length : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ id?: string; draft?: DraftRow }>(`/api/projects/${projectId}/drafts`, "POST", {
        ...form,
        compare_serp: form.compare_serp && !!form.target_keyword,
        live_check: form.ai_rewrite && form.live_check,
        research_run_ids: runIds,
      });
      if (res.id) router.push(`/projects/${projectId}/studio/${res.id}`);
      else if (res.draft) {
        setInline(res.draft);
        setBusy(false);
      }
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (inline) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-amber-300">Preview mode: results aren&apos;t saved.</p>
          <Button variant="secondary" size="sm" onClick={() => setInline(null)}>
            ← Back to the form
          </Button>
        </div>
        <DraftResult draft={inline} />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Title" className="sm:col-span-1">
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Best hotels in Adelaide CBD" />
          </Field>
          <Field label="Content type">
            <Select value={form.content_type} onChange={(e) => setForm({ ...form, content_type: e.target.value })}>
              {CONTENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Target keyword">
            <Input value={form.target_keyword} onChange={(e) => setForm({ ...form, target_keyword: e.target.value })} placeholder="best hotels in adelaide cbd" />
          </Field>
        </div>
        <Field label="Your content" hint={`${words.toLocaleString()} words · Markdown, plain text or pasted from Google Docs`}>
          <Textarea required rows={16} value={form.original_content} onChange={(e) => setForm({ ...form, original_content: e.target.value })} placeholder="Paste the draft here…" className="font-mono text-[13px]" />
        </Field>
      </Card>

      <Card className="space-y-4">
        <h3 className="font-semibold">Checks</h3>
        <p className="text-sm text-ink-500">Always included: SEO (keyword, headings, links), GEO (can AI answer where to stay / why this brand), brand compliance (restricted claims, banned words, names, figures, spelling) and conversion (CTA).</p>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" checked={form.compare_serp} onChange={(e) => setForm({ ...form, compare_serp: e.target.checked })} />
          <span>
            Compare with the live SERP
            <span className="block text-xs text-ink-500">Checks entity coverage against today&apos;s top results for the keyword (1 SerpApi search).</span>
          </span>
        </label>
      </Card>

      <Card className={cn("space-y-4", !aiEnabled && "opacity-60")}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">AI rewrite</h3>
          {!aiEnabled && <span className="text-xs text-ink-500">Needs AI Enhanced mode (Settings)</span>}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" disabled={!aiEnabled} checked={form.ai_rewrite} onChange={(e) => setForm({ ...form, ai_rewrite: e.target.checked })} />
          <span>
            Rewrite with brand facts, SERP insights, competitor gaps and customer questions
            <span className="block text-xs text-ink-500">The rewrite is told to fix every failed check.</span>
          </span>
        </label>
        {form.ai_rewrite && (
          <>
            <Field label="Attach research" hint="Customer questions, local facts and competitor data from these runs are used in the rewrite.">
              <RunPicker runs={runs} value={runIds} onChange={setRunIds} />
            </Field>
            <Field label="Extra instructions (optional)">
              <Textarea rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Keep under 900 words, add an FAQ section…" />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" checked={form.live_check} onChange={(e) => setForm({ ...form, live_check: e.target.checked })} />
              <span>
                Live web fact-check
                <span className="block text-xs text-ink-500">Verifies claims about the brand, competitors and local places with web search first. Slower, more accurate.</span>
              </span>
            </label>
          </>
        )}
      </Card>

      <ErrorNote>{error}</ErrorNote>
      <Button disabled={busy} className="min-w-48">
        {busy ? (
          <>
            <Spinner /> {form.ai_rewrite ? "Checking & rewriting… (1–3 min)" : "Checking…"}
          </>
        ) : form.ai_rewrite ? (
          "Check & rewrite"
        ) : (
          "Run checks"
        )}
      </Button>
    </form>
  );
}

/** Read-only result used in preview mode. */
export function DraftResult({ draft }: { draft: DraftRow }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <Card>
        <h2 className="mb-3 text-lg font-semibold">{draft.title}</h2>
        {draft.revised_content ? (
          <div className="prose-lite">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.revised_content}</ReactMarkdown>
          </div>
        ) : (
          <div className="prose-lite">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.original_content}</ReactMarkdown>
          </div>
        )}
      </Card>
      {draft.optimisation && <OptimisationPanel report={draft.optimisation} />}
    </div>
  );
}
