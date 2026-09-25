import Link from "next/link";
import { Badge, StatusBadge, ButtonLink, Card, Stat, formatDate, pct } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { VisibilitySummary } from "@/lib/research/visibility";
import type { Project } from "@/lib/types";
import { KnowledgeScoreCard } from "@/components/knowledge-score";
import { knowledgeScore } from "@/lib/intel/knowledge";

export default async function ProjectOverview({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: p }, docs, drafts, feedback, runs, briefs, gsc, rules, allDrafts] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("project_id", id),
    supabase.from("content_drafts").select("id, title, status, updated_at").eq("project_id", id).order("updated_at", { ascending: false }).limit(5),
    supabase.from("feedback_logs").select("id, content, kind, source, created_at").eq("project_id", id).eq("status", "open").order("created_at", { ascending: false }).limit(5),
    supabase.from("research_runs").select("id, kind, query, status, summary, created_at").eq("project_id", id).order("created_at", { ascending: false }).limit(6),
    supabase.from("content_briefs").select("id", { count: "exact", head: true }).eq("project_id", id),
    supabase.from("gsc_queries").select("id", { count: "exact", head: true }).eq("project_id", id),
    supabase.from("feedback_logs").select("id", { count: "exact", head: true }).eq("project_id", id).eq("apply_as_rule", true),
    supabase.from("content_drafts").select("optimisation").eq("project_id", id),
  ]);
  const project = p as Project;
  const latestVis = runs.data?.find((r) => r.kind === "ai_visibility" && r.status === "done");
  const vis = latestVis?.summary as VisibilitySummary | undefined;

  const researchCount = runs.data?.length ?? 0;
  const ks = knowledgeScore(project, { documents: docs.count ?? 0, rules: rules.count ?? 0, research: researchCount });
  const scores = (allDrafts.data ?? []).map((d) => (d.optimisation as { overall?: number } | null)?.overall).filter((n): n is number => typeof n === "number");
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const base = `/projects/${id}`;
  const steps = [
    { label: "Brand understanding", detail: `Knowledge score ${ks.score}%`, done: ks.score >= 60, href: `${base}/settings` },
    { label: "Customer understanding", detail: runs.data?.some((r) => r.kind === "local_context") ? "Market research done" : "Run market research", done: !!runs.data?.some((r) => r.kind === "local_context"), href: `${base}/research` },
    { label: "Competitor understanding", detail: `${(project.competitors ?? []).length} competitors${vis ? " · AI visibility checked" : ""}`, done: (project.competitors ?? []).length >= 2, href: `${base}/visibility` },
    { label: "Search intelligence", detail: gsc.count ? `${gsc.count} GSC queries` : "Import Search Console", done: (gsc.count ?? 0) > 0, href: `${base}/opportunities` },
    { label: "Content strategy", detail: `${briefs.count ?? 0} briefs`, done: (briefs.count ?? 0) > 0, href: `${base}/briefs` },
    { label: "Content creation", detail: `${allDrafts.data?.length ?? 0} drafts`, done: (allDrafts.data?.length ?? 0) > 0, href: `${base}/studio` },
    { label: "Quality validation", detail: avgScore != null ? `Avg. score ${avgScore}` : "No checked drafts", done: avgScore != null && avgScore >= 70, href: `${base}/studio` },
    { label: "Feedback learning", detail: `${rules.count ?? 0} rules`, done: (rules.count ?? 0) > 0, href: `${base}/feedback` },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="mb-4 font-semibold">Workflow</h3>
        <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((st, i) => (
            <li key={st.label}>
              <Link href={st.href} className="flex items-start gap-3 rounded-lg border border-ink-200 p-3 hover:border-brand-300 hover:bg-surface-2">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${st.done ? "bg-emerald-500 text-ink-50" : "bg-ink-100 text-ink-600 ring-1 ring-ink-300"}`}>{st.done ? "✓" : i + 1}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{st.label}</span>
                  <span className="block truncate text-xs text-ink-500">{st.detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </Card>
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Brand docs" value={docs.count ?? 0} />
          <Stat label="Drafts" value={drafts.data?.length ?? 0} hint="latest 5 shown" />
          <Stat label="Open feedback" value={feedback.data?.length ?? 0} />
          <Stat label="ChatGPT mention rate" value={pct(vis?.brand?.ai_mention_rate)} hint={latestVis ? `“${latestVis.query}”` : "not measured"} />
        </div>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Recent drafts</h3>
            <ButtonLink href={`/projects/${id}/studio`} variant="secondary">
              New draft
            </ButtonLink>
          </div>
          {drafts.data?.length ? (
            <ul className="divide-y divide-ink-100">
              {drafts.data.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2.5">
                  <Link href={`/projects/${id}/studio/${d.id}`} className="font-medium hover:text-brand-700">
                    {d.title}
                  </Link>
                  <span className="flex items-center gap-3 text-xs text-ink-500">
                    <StatusBadge status={d.status} />
                    {formatDate(d.updated_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">Paste existing content into the Content Studio to get a brand-checked revision.</p>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 font-semibold">Research</h3>
          {runs.data?.length ? (
            <ul className="divide-y divide-ink-100">
              {runs.data.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2.5">
                  <Link href={`/projects/${id}/${r.kind === "local_context" ? "research" : "visibility"}/${r.id}`} className="font-medium hover:text-brand-700">
                    {r.query}
                  </Link>
                  <span className="flex items-center gap-2 text-xs text-ink-500">
                    <Badge tone={r.kind === "local_context" ? "blue" : "violet"}>{r.kind === "local_context" ? "Local research" : "AI visibility"}</Badge>
                    {formatDate(r.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">No research yet.</p>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <KnowledgeScoreCard score={ks.score} items={ks.items} compact />

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Open feedback</h3>
            <Link href={`/projects/${id}/feedback`} className="text-sm text-brand-700 hover:underline">
              View log
            </Link>
          </div>
          {feedback.data?.length ? (
            <ul className="space-y-3 text-sm">
              {feedback.data.map((f) => (
                <li key={f.id}>
                  <p className="line-clamp-2 text-ink-800">{f.content}</p>
                  <p className="text-xs text-ink-500">
                    {f.source} · {f.kind.replace("_", " ")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">Nothing open.</p>
          )}
        </Card>
      </div>
    </div>
    </div>
  );
}
