"use client";

import { diffWords } from "diff";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/fetcher";
import type { DraftRow, FeedbackRow } from "@/lib/types";
import { FeedbackForm } from "@/components/feedback";
import { RunPicker, type RunOption } from "@/components/studio";
import { Badge, StatusBadge, Button, Card, ErrorNote, Select, Spinner, Textarea, cn, formatDate, severityTone } from "@/components/ui";
import { MANUAL_STATUSES, stage } from "@/lib/pipeline";

type Tab = "revised" | "diff" | "original";

export function DraftView({ projectId, draft, feedback, runs }: { projectId: string; draft: DraftRow; feedback: FeedbackRow[]; runs: RunOption[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("revised");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(draft.revised_content ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rerunOpen, setRerunOpen] = useState(false);
  const [rerun, setRerun] = useState({ instructions: "", live_check: false, research_run_ids: draft.research_run_ids });
  const a = draft.analysis;

  const diff = useMemo(() => (tab === "diff" && draft.revised_content ? diffWords(draft.original_content, draft.revised_content) : []), [tab, draft]);

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const url = `/api/projects/${projectId}/drafts/${draft.id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{draft.title}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-500">
            <StatusBadge status={draft.status} />
            {draft.content_type && <span>{draft.content_type}</span>}
            {draft.target_keyword && <span>· {draft.target_keyword}</span>}
            <span>· updated {formatDate(draft.updated_at)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!draft.revised_content}
            onClick={async () => {
              await navigator.clipboard.writeText(draft.revised_content ?? "");
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied" : "Copy revised"}
          </Button>
          <Button variant="secondary" onClick={() => setRerunOpen((v) => !v)} disabled={!!busy}>
            Re-run review
          </Button>
          <Select
            value={draft.status === "processing" || draft.status === "error" ? "" : draft.status}
            disabled={!!busy || draft.status === "processing"}
            onChange={(e) => e.target.value && act("status", () => api(url, "PATCH", { status: e.target.value }))}
            className="w-40"
            aria-label="Pipeline stage"
          >
            {(draft.status === "processing" || draft.status === "error") && <option value="">{stage(draft.status).label}</option>}
            {MANUAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {stage(s).label}
              </option>
            ))}
          </Select>
          <Button
            variant="ghost"
            className="text-red-300"
            onClick={async () => {
              if (!confirm("Delete this draft?")) return;
              await api(url, "DELETE");
              router.push(`/projects/${projectId}/studio`);
            }}
          >
            Delete
          </Button>
        </div>
      </div>

      {rerunOpen && (
        <Card className="space-y-3">
          <p className="text-sm text-ink-600">Re-runs the review with the latest brand library, feedback rules and selected research.</p>
          <RunPicker runs={runs} value={rerun.research_run_ids} onChange={(ids) => setRerun({ ...rerun, research_run_ids: ids })} />
          <Textarea rows={2} placeholder="Extra instructions (optional)" value={rerun.instructions} onChange={(e) => setRerun({ ...rerun, instructions: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={rerun.live_check} onChange={(e) => setRerun({ ...rerun, live_check: e.target.checked })} /> Live web fact-check
          </label>
          <Button disabled={!!busy} onClick={() => act("rerun", () => api(url, "POST", rerun)).then(() => setRerunOpen(false))}>
            {busy === "rerun" ? (
              <>
                <Spinner /> Re-running…
              </>
            ) : (
              "Run again"
            )}
          </Button>
        </Card>
      )}

      <ErrorNote>{error || draft.error}</ErrorNote>
      {draft.status === "processing" && !busy && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">This draft is still processing or was interrupted. Refresh in a minute, or re-run the review.</p>
      )}

      {a && (
        <Card className="bg-brand-50/50">
          <p className="text-sm text-ink-800">{a.summary}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-600">
            <span>
              <strong className="text-ink-900">{a.fact_checks.length}</strong> fact issues
            </span>
            <span>
              <strong className="text-ink-900">{a.fact_checks.filter((f) => f.severity === "high").length}</strong> high severity
            </span>
            <span>
              <strong className="text-ink-900">{a.added_facts.length}</strong> brand facts added
            </span>
            <span>
              <strong className="text-ink-900">{a.questions_for_client.length}</strong> questions for client
            </span>
            {a.context_used && (
              <span>
                Used {a.context_used.documents.length} docs · {a.context_used.rules} rules · {a.context_used.research.length} research runs
              </span>
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-ink-100 px-4">
            <div className="flex">
              {(["revised", "diff", "original"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn("border-b-2 px-3 py-2.5 text-sm font-medium capitalize", tab === t ? "border-brand-700 text-brand-800" : "border-transparent text-ink-500")}
                >
                  {t === "diff" ? "Changes" : t}
                </button>
              ))}
            </div>
            {tab === "revised" && draft.revised_content && (
              <div className="flex gap-1">
                {editing ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => (setEditing(false), setText(draft.revised_content ?? ""))}>
                      Cancel
                    </Button>
                    <Button size="sm" disabled={!!busy} onClick={() => act("save", () => api(url, "PATCH", { revised_content: text })).then(() => setEditing(false))}>
                      Save
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="p-5">
            {tab === "revised" &&
              (editing ? (
                <Textarea rows={30} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-[13px]" />
              ) : draft.revised_content ? (
                <div className="prose-lite">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.revised_content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-ink-500">No revision yet.</p>
              ))}
            {tab === "diff" && (
              <div className="whitespace-pre-wrap text-sm leading-7">
                {diff.map((part, i) => (
                  <span key={i} className={part.added ? "diff-add" : part.removed ? "diff-del" : undefined}>
                    {part.value}
                  </span>
                ))}
              </div>
            )}
            {tab === "original" && <div className="whitespace-pre-wrap text-sm leading-7 text-ink-800">{draft.original_content}</div>}
          </div>
        </Card>

        <div className="space-y-4">
          {a && a.fact_checks.length > 0 && (
            <Card>
              <h3 className="mb-3 font-semibold">Fact-check</h3>
              <ul className="space-y-3">
                {a.fact_checks.map((f, i) => (
                  <li key={i} className="rounded-lg border border-ink-100 p-3 text-sm">
                    <div className="mb-1.5 flex flex-wrap gap-1.5">
                      <Badge tone={severityTone[f.severity]}>{f.severity}</Badge>
                      <Badge>{f.type.replace("_", " ")}</Badge>
                    </div>
                    <p className="diff-del inline">{f.original}</p>
                    <p className="mt-1 text-ink-700">{f.issue}</p>
                    <p className="mt-1">
                      <span className="diff-add">{f.correction}</span>
                    </p>
                    <p className="mt-1 text-xs text-ink-500">Source: {f.evidence}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {a && a.questions_for_client.length > 0 && (
            <Card>
              <h3 className="mb-2 font-semibold">Confirm with client</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink-800">
                {a.questions_for_client.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </Card>
          )}

          {a && a.added_facts.length > 0 && (
            <Card>
              <h3 className="mb-2 font-semibold">Brand facts added</h3>
              <ul className="space-y-1.5 text-sm">
                {a.added_facts.map((f, i) => (
                  <li key={i}>
                    {f.fact} <span className="text-xs text-ink-500">({f.source})</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {a && (a.tone_notes.length > 0 || a.seo_geo_notes.length > 0) && (
            <Card>
              {a.tone_notes.length > 0 && (
                <>
                  <h3 className="mb-2 font-semibold">Tone of voice</h3>
                  <ul className="mb-4 list-disc space-y-1 pl-5 text-sm">
                    {a.tone_notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </>
              )}
              {a.seo_geo_notes.length > 0 && (
                <>
                  <h3 className="mb-2 font-semibold">SEO / GEO</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {a.seo_geo_notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          )}

          {a && a.changes.length > 0 && (
            <Card>
              <h3 className="mb-3 font-semibold">Key edits</h3>
              <ul className="space-y-3 text-sm">
                {a.changes.map((c, i) => (
                  <li key={i}>
                    <p>
                      <span className="diff-del">{c.before}</span>
                    </p>
                    <p>
                      <span className="diff-add">{c.after}</span>
                    </p>
                    <p className="text-xs text-ink-500">{c.reason}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <h3 className="mb-3 font-semibold">Feedback on this draft</h3>
            {feedback.length > 0 && (
              <ul className="mb-4 space-y-2 text-sm">
                {feedback.map((f) => (
                  <li key={f.id} className="rounded-lg bg-ink-50 p-2.5">
                    <p>{f.content}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      {f.source} · {f.status}
                      {(f.apply_as_rule || f.kind !== "feedback") && " · applied as rule"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <FeedbackForm projectId={projectId} draftId={draft.id} />
          </Card>
        </div>
      </div>
    </div>
  );
}
