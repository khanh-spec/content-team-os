"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/fetcher";
import { Button, ErrorNote, Field, Input, Spinner } from "@/components/ui";

export function LocalResearchForm({ projectId, sources, location }: { projectId: string; sources: { id: string; label: string }[]; location: string }) {
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
      const { id } = await api<{ id: string }>(`/api/projects/${projectId}/research`, "POST", { topic, sources: selected });
      router.push(`/projects/${projectId}/research/${id}`);
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
