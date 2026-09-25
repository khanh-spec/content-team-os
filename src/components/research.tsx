"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/fetcher";
import { ResearchReport, type StoredResearch } from "@/components/research-report";
import { Button, ErrorNote, Field, Input, Spinner } from "@/components/ui";
import type { LocalSources } from "@/lib/research/local";

type InlineRun = { query: string; summary: StoredResearch; sources: LocalSources };

export function LocalResearchForm({ projectId, sources, location, onResult }: { projectId: string; sources: { id: string; label: string }[]; location: string; onResult?: (run: InlineRun) => void }) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [selected, setSelected] = useState(sources.map((s) => s.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ id?: string; run?: InlineRun }>(`/api/projects/${projectId}/research`, "POST", { topic, sources: selected });
      if (res.id) router.push(`/projects/${projectId}/research/${res.id}`);
      else if (res.run) {
        onResult?.(res.run);
        setBusy(false);
      }
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Topic or query" hint={location ? `Localized to ${location}` : "Set the city/location in Brand Profile for localized results"}>
        <Input required value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="best area to stay in Hoi An" />
      </Field>
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-sm font-medium">Sources</legend>
        {sources.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(s.id)}
              onChange={(e) => setSelected(e.target.checked ? [...selected, s.id] : selected.filter((x) => x !== s.id))}
            />
            {s.label}
          </label>
        ))}
        <p className="pt-1 text-xs text-ink-500">Uses roughly 6–14 SerpApi searches per run.</p>
      </fieldset>
      <ErrorNote>{error}</ErrorNote>
      <Button disabled={busy || !selected.length} className="w-full">
        {busy ? (
          <>
            <Spinner /> Researching… (≈1 min)
          </>
        ) : (
          "Run research"
        )}
      </Button>
    </form>
  );
}

/** Research form + inline result (preview mode returns results without saving). */
export function ResearchWorkspace({ children, ...props }: { projectId: string; sources: { id: string; label: string }[]; location: string; children?: React.ReactNode }) {
  const [run, setRun] = useState<InlineRun | null>(null);
  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="h-fit rounded-xl border border-ink-200 bg-surface p-5">
          <LocalResearchForm {...props} onResult={setRun} />
        </div>
        <div>{children}</div>
      </div>
      {run && (
        <div className="space-y-2">
          <p className="text-sm text-amber-300">Preview mode: this result isn&apos;t saved.</p>
          <h2 className="text-xl font-semibold">{run.query}</h2>
          <ResearchReport projectId={props.projectId} summary={run.summary} src={run.sources} />
        </div>
      )}
    </div>
  );
}
