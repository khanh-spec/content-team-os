"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Angles, ModeBadge, TopResults } from "@/components/insight";
import { Badge, Button, Card, ErrorNote, Spinner } from "@/components/ui";
import { api } from "@/lib/fetcher";
import type { ContentBrief } from "@/lib/intel/brief";

export function briefInstructions(b: ContentBrief) {
  return [
    `Intent: ${b.searchIntent}. Audience: ${b.audience.join(", ")}.`,
    `Outline: ${b.outline.map((o) => o.heading).join(" | ")}`,
    b.requiredEntities.length ? `Mention: ${b.requiredEntities.map((e) => e.name).join(", ")}` : "",
    b.brandIntegration.length ? `Use facts: ${b.brandIntegration.filter((x) => !x.detail.startsWith("MISSING")).map((x) => x.detail).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function BriefView({ projectId, brief, aiEnabled }: { projectId: string; brief: ContentBrief; aiEnabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const studioHref = `/projects/${projectId}/studio?title=${encodeURIComponent(brief.titleIdeas[0] ?? brief.topic)}&keyword=${encodeURIComponent(brief.topic)}&brief=${encodeURIComponent(briefInstructions(brief))}`;

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ id?: string }>(`/api/projects/${projectId}/drafts`, "POST", { mode: "generate", brief });
      if (res.id) router.push(`/projects/${projectId}/studio/${res.id}`);
      else setError("Generated, but preview mode can't save drafts. Connect Supabase to keep them.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{brief.topic}</h2>
            <ModeBadge mode={brief.mode} />
          </div>
          <p className="text-sm text-ink-500">
            {brief.brand} · {brief.searchIntent} · {brief.wordCount.min.toLocaleString()}–{brief.wordCount.max.toLocaleString()} words
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={studioHref} className="inline-flex items-center rounded-lg bg-surface-2 px-4 py-2 text-sm font-medium ring-1 ring-ink-300 hover:bg-ink-100">
            Write it myself →
          </Link>
          <Button onClick={generate} disabled={!aiEnabled || busy} title={aiEnabled ? "" : "Turn on AI Enhanced mode in Settings"}>
            {busy ? (
              <>
                <Spinner /> Writing draft…
              </>
            ) : (
              "Generate draft with AI"
            )}
          </Button>
        </div>
      </div>
      {!aiEnabled && <p className="text-xs text-ink-500">Free mode: write the draft yourself, then check it in the Optimise workspace. AI drafts need AI Enhanced mode.</p>}
      <ErrorNote>{error}</ErrorNote>

      {brief.aiNotes && (
        <Card className="prose-lite border-brand-300 bg-brand-50">
          <ReactMarkdown>{brief.aiNotes}</ReactMarkdown>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink-500">Search intent</p>
          <p className="mt-1 text-lg font-semibold">{brief.searchIntent}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink-500">Audience</p>
          <ul className="mt-1 space-y-0.5 text-sm">{brief.audience.length ? brief.audience.map((a) => <li key={a}>{a}</li>) : <li className="text-ink-500">Add target audiences to the brand profile.</li>}</ul>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink-500">Title ideas</p>
          <ul className="mt-1 space-y-1 text-sm">{brief.titleIdeas.map((t) => <li key={t}>{t}</li>)}</ul>
          <p className="mt-2 text-xs text-ink-500">Meta: {brief.metaDescription}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <h3 className="mb-3 font-semibold">Outline</h3>
          <ol className="space-y-3">
            {brief.outline.map((o, i) => (
              <li key={i}>
                <p className="font-medium">
                  <span className="mr-2 font-mono text-xs text-ink-500">H2</span>
                  {o.heading}
                </p>
                <ul className="ml-8 list-disc text-sm text-ink-600">
                  {o.notes.map((n, j) => (
                    <li key={j}>{n}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Card>
        <div className="space-y-6">
          <Card>
            <h3 className="mb-3 font-semibold">Customer questions</h3>
            <ul className="space-y-1.5 text-sm">
              {brief.customerQuestions.map((q) => (
                <li key={q.question}>
                  {q.question} <span className="text-xs text-ink-500">({q.sources.join(", ")})</span>
                </li>
              ))}
              {!brief.customerQuestions.length && <li className="text-ink-500">None found.</li>}
            </ul>
          </Card>
          <Card>
            <h3 className="mb-3 font-semibold">Required entities</h3>
            <div className="flex flex-wrap gap-1.5">
              {brief.requiredEntities.map((e) => (
                <Badge key={e.name} tone={e.type === "Landmark" ? "blue" : "gray"}>
                  {e.name}
                </Badge>
              ))}
              {!brief.requiredEntities.length && <span className="text-sm text-ink-500">None detected.</span>}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-semibold">Brand integration</h3>
          <ul className="space-y-2 text-sm">
            {brief.brandIntegration.map((b, i) => (
              <li key={i} className={b.detail.startsWith("MISSING") ? "text-amber-300" : ""}>
                <span className="text-xs uppercase text-ink-500">{b.point}</span>
                <br />
                {b.detail}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3 className="mb-3 font-semibold">Internal links</h3>
          <ul className="space-y-2 text-sm">
            {brief.internalLinks.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noreferrer" className="text-brand-800 hover:underline">
                  {l.title}
                </a>
                <span className="text-xs text-ink-500"> · {l.reason}</span>
              </li>
            ))}
            {!brief.internalLinks.length && <li className="text-ink-500">Add site pages (rooms, dining, offers) in Brand Intelligence to get link suggestions.</li>}
          </ul>
        </Card>
        <Card>
          <h3 className="mb-3 font-semibold">Competitor angles to match</h3>
          <Angles items={brief.competitorAngles.map((a) => ({ topic: a.label, label: a.label, coverage: a.coverage, results: 0 }))} />
        </Card>
        <Card>
          <h3 className="mb-3 font-semibold">Gaps to win</h3>
          <ul className="space-y-2 text-sm">
            {brief.gaps.map((g) => (
              <li key={g.label}>
                <span className="text-red-400">❌</span> <span className="font-medium">{g.label}</span> <Badge>{g.format}</Badge>
                <p className="ml-5 text-ink-500">{g.reason}</p>
              </li>
            ))}
            {!brief.gaps.length && <li className="text-ink-500">No gaps detected.</li>}
          </ul>
        </Card>
      </div>

      <Card>
        <h3 className="mb-3 font-semibold">GEO checklist: AI should be able to answer…</h3>
        <ul className="space-y-1 text-sm">
          {brief.geoChecklist.map((g) => (
            <li key={g}>☐ {g}</li>
          ))}
        </ul>
      </Card>
      <Card>
        <h3 className="mb-3 font-semibold">What ranks today</h3>
        <TopResults items={brief.topResults} />
      </Card>
    </div>
  );
}

export function BriefForm({ projectId, initialTopic, aiEnabled }: { projectId: string; initialTopic?: string; aiEnabled: boolean }) {
  const router = useRouter();
  const [topic, setTopic] = useState(initialTopic ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inline, setInline] = useState<ContentBrief | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ id?: string; brief?: ContentBrief }>(`/api/projects/${projectId}/briefs`, "POST", { topic });
      if (res.id) router.push(`/projects/${projectId}/briefs/${res.id}`);
      else if (res.brief) setInline(res.brief);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-xl border border-ink-200 bg-surface p-5">
        <label className="min-w-64 flex-1 space-y-1.5">
          <span className="text-sm font-medium">Topic</span>
          <input
            required
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Best things to do in Adelaide"
            className="w-full rounded-lg border border-ink-300 bg-surface-2 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
        <Button disabled={busy}>
          {busy ? (
            <>
              <Spinner /> Researching…
            </>
          ) : (
            "Generate brief"
          )}
        </Button>
        <p className="w-full text-xs text-ink-500">Uses 2 SerpApi searches. {aiEnabled ? "AI Enhanced mode also refines the outline and writes an intro." : "Free mode builds the brief with the rules engine."}</p>
        <div className="w-full">
          <ErrorNote>{error}</ErrorNote>
        </div>
      </form>
      {inline && (
        <div className="space-y-2">
          <p className="text-sm text-amber-300">Preview mode: this brief isn&apos;t saved.</p>
          <BriefView projectId={projectId} brief={inline} aiEnabled={aiEnabled} />
        </div>
      )}
    </div>
  );
}
