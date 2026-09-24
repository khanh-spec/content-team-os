"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/fetcher";
import type { FeedbackRow } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Select, Textarea, cn, formatDate } from "@/components/ui";

const KIND_LABEL = { feedback: "Feedback", rule: "Writing rule", fact_correction: "Fact correction" } as const;
const KIND_TONE = { feedback: "gray", rule: "brand", fact_correction: "amber" } as const;

export function FeedbackForm({ projectId, draftId, drafts, onDone }: { projectId: string; draftId?: string; drafts?: { id: string; title: string }[]; onDone?: () => void }) {
  const router = useRouter();
  const blank = { content: "", context: "", source: "client", kind: "feedback", apply_as_rule: false, author_name: "", draft_id: draftId ?? "" };
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/projects/${projectId}/feedback`, "POST", {
        ...form,
        apply_as_rule: form.apply_as_rule || form.kind !== "feedback",
        draft_id: form.draft_id || null,
        context: form.context || null,
        author_name: form.author_name || null,
      });
      setForm(blank);
      router.refresh();
      onDone?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Feedback">
        <Textarea required rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder='e.g. "We never call it a resort — always Boutique Hotel. Pool is on the rooftop, not garden level."' />
      </Field>
      <Field label="Refers to (optional)" hint="Paste the sentence or section it applies to">
        <Input value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From">
          <Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            <option value="client">Client</option>
            <option value="internal">Internal team</option>
            <option value="editor">Editor</option>
          </Select>
        </Field>
        <Field label="Type">
          <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="feedback">Feedback</option>
            <option value="rule">Writing rule</option>
            <option value="fact_correction">Fact correction</option>
          </Select>
        </Field>
      </div>
      <Field label="Name (optional)">
        <Input value={form.author_name} onChange={(e) => setForm({ ...form, author_name: e.target.value })} />
      </Field>
      {drafts && drafts.length > 0 && !draftId && (
        <Field label="Related draft (optional)">
          <Select value={form.draft_id} onChange={(e) => setForm({ ...form, draft_id: e.target.value })}>
            <option value="">—</option>
            {drafts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={form.apply_as_rule || form.kind !== "feedback"}
          disabled={form.kind !== "feedback"}
          onChange={(e) => setForm({ ...form, apply_as_rule: e.target.checked })}
        />
        <span>
          Apply to all future drafts
          <span className="block text-xs text-ink-500">Rules and fact corrections always apply.</span>
        </span>
      </label>
      <ErrorNote>{error}</ErrorNote>
      <Button disabled={busy} className="w-full">
        {busy ? "Saving…" : "Log feedback"}
      </Button>
    </form>
  );
}

export function FeedbackLog({ projectId, items, drafts }: { projectId: string; items: FeedbackRow[]; drafts: { id: string; title: string }[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<"open" | "applied" | "archived" | "all">("open");
  const [kind, setKind] = useState<"all" | FeedbackRow["kind"]>("all");
  const [q, setQ] = useState("");
  const draftTitle = useMemo(() => new Map(drafts.map((d) => [d.id, d.title])), [drafts]);

  const filtered = items.filter(
    (f) =>
      (status === "all" || f.status === status) &&
      (kind === "all" || f.kind === kind) &&
      (!q || `${f.content} ${f.context ?? ""} ${f.author_name ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );
  const rules = items.filter((f) => f.status !== "archived" && (f.apply_as_rule || f.kind !== "feedback")).length;

  async function patch(id: string, body: Partial<FeedbackRow>) {
    await api(`/api/projects/${projectId}/feedback/${id}`, "PATCH", body).catch((e) => alert(e.message));
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card className="h-fit">
        <FeedbackForm projectId={projectId} drafts={drafts} />
      </Card>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {(["open", "applied", "archived", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn("rounded-full px-3 py-1 text-sm capitalize", status === s ? "bg-brand-600 text-white" : "bg-surface text-ink-600 ring-1 ring-ink-200")}
            >
              {s} ({s === "all" ? items.length : items.filter((f) => f.status === s).length})
            </button>
          ))}
          <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="w-auto">
            <option value="all">All types</option>
            <option value="feedback">Feedback</option>
            <option value="rule">Writing rules</option>
            <option value="fact_correction">Fact corrections</option>
          </Select>
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-48" />
          <span className="ml-auto text-sm text-ink-500">{rules} active rules applied to rewrites</span>
        </div>

        {filtered.length === 0 ? (
          <Empty title="Nothing here">Log feedback from client emails, review calls or editor passes.</Empty>
        ) : (
          <ul className="space-y-3">
            {filtered.map((f) => {
              const isRule = f.apply_as_rule || f.kind !== "feedback";
              return (
                <li key={f.id} className={cn("rounded-xl border bg-surface p-4", f.status === "archived" ? "border-ink-100 opacity-60" : "border-ink-200")}>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <Badge tone={KIND_TONE[f.kind]}>{KIND_LABEL[f.kind]}</Badge>
                    {isRule && f.kind === "feedback" && <Badge tone="brand">Applied as rule</Badge>}
                    <Badge tone={f.status === "open" ? "amber" : f.status === "applied" ? "green" : "gray"}>{f.status}</Badge>
                    <span className="text-ink-500">
                      {f.source}
                      {f.author_name ? ` · ${f.author_name}` : ""} · {formatDate(f.created_at)}
                    </span>
                    {f.draft_id && draftTitle.get(f.draft_id) && (
                      <Link href={`/projects/${projectId}/studio/${f.draft_id}`} className="text-brand-700 hover:underline">
                        {draftTitle.get(f.draft_id)}
                      </Link>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-ink-900">{f.content}</p>
                  {f.context && <p className="mt-2 border-l-2 border-ink-200 pl-3 text-sm italic text-ink-500">{f.context}</p>}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {f.status === "open" && (
                      <Button size="sm" variant="secondary" onClick={() => patch(f.id, { status: "applied" })}>
                        Mark applied
                      </Button>
                    )}
                    {f.status !== "open" && (
                      <Button size="sm" variant="ghost" onClick={() => patch(f.id, { status: "open" })}>
                        Reopen
                      </Button>
                    )}
                    {f.kind === "feedback" && (
                      <Button size="sm" variant="ghost" onClick={() => patch(f.id, { apply_as_rule: !f.apply_as_rule })}>
                        {f.apply_as_rule ? "Stop applying as rule" : "Apply as rule"}
                      </Button>
                    )}
                    {f.status !== "archived" && (
                      <Button size="sm" variant="ghost" onClick={() => patch(f.id, { status: "archived" })}>
                        Archive
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-300"
                      onClick={async () => {
                        if (!confirm("Delete this entry?")) return;
                        await api(`/api/projects/${projectId}/feedback/${f.id}`, "DELETE").catch((e) => alert(e.message));
                        router.refresh();
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
