"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/fetcher";
import { Badge, Button, Card, ErrorNote, Field, Input, Select, Spinner, Textarea, cn } from "@/components/ui";

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

export function NewDraftForm({ projectId, runs, initial }: { projectId: string; runs: RunOption[]; initial?: { title?: string; target_keyword?: string; instructions?: string } }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    content_type: "Blog article",
    target_keyword: initial?.target_keyword ?? "",
    original_content: "",
    instructions: initial?.instructions ?? "",
    live_check: true,
  });
  const [runIds, setRunIds] = useState<string[]>(runs.slice(0, 2).map((r) => r.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const words = form.original_content.trim() ? form.original_content.trim().split(/\s+/).length : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>(`/api/projects/${projectId}/drafts`, "POST", { ...form, research_run_ids: runIds });
      router.push(`/projects/${projectId}/studio/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Title" className="sm:col-span-1">
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Things to do near Hoi An Old Town" />
          </Field>
          <Field label="Content type">
            <Select value={form.content_type} onChange={(e) => setForm({ ...form, content_type: e.target.value })}>
              {CONTENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Target keyword / topic">
            <Input value={form.target_keyword} onChange={(e) => setForm({ ...form, target_keyword: e.target.value })} placeholder="boutique hotel hoi an old town" />
          </Field>
        </div>
        <Field label="Your content" hint={`${words.toLocaleString()} words · Markdown, plain text or pasted from Google Docs`}>
          <Textarea required rows={16} value={form.original_content} onChange={(e) => setForm({ ...form, original_content: e.target.value })} placeholder="Paste the draft here…" className="font-mono text-[13px]" />
        </Field>
      </Card>

      <Card className="space-y-4">
        <Field label="Attach research" hint="Customer questions, local facts and competitor data from these runs are used in the rewrite.">
          <RunPicker runs={runs} value={runIds} onChange={setRunIds} />
        </Field>
        <Field label="Extra instructions (optional)">
          <Textarea rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Keep under 900 words, add an FAQ section, UK English…" />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" checked={form.live_check} onChange={(e) => setForm({ ...form, live_check: e.target.checked })} />
          <span>
            Live web fact-check
            <span className="block text-xs text-ink-500">Verifies claims about the brand, competitors and local places with web search before rewriting. Slower, more accurate.</span>
          </span>
        </label>
      </Card>

      <ErrorNote>{error}</ErrorNote>
      <Button disabled={busy} className="min-w-48">
        {busy ? (
          <>
            <Spinner /> Checking & rewriting… (1–3 min)
          </>
        ) : (
          "Fact-check & rewrite"
        )}
      </Button>
    </form>
  );
}
