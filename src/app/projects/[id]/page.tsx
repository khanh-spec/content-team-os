import Link from "next/link";
import { Badge, StatusBadge, ButtonLink, Card, Stat, formatDate, pct } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { VisibilitySummary } from "@/lib/research/visibility";
import type { Project } from "@/lib/types";

export default async function ProjectOverview({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: p }, docs, drafts, feedback, runs] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("project_id", id),
    supabase.from("content_drafts").select("id, title, status, updated_at").eq("project_id", id).order("updated_at", { ascending: false }).limit(5),
    supabase.from("feedback_logs").select("id, content, kind, source, created_at").eq("project_id", id).eq("status", "open").order("created_at", { ascending: false }).limit(5),
    supabase.from("research_runs").select("id, kind, query, status, summary, created_at").eq("project_id", id).order("created_at", { ascending: false }).limit(6),
  ]);
  const project = p as Project;
  const latestVis = runs.data?.find((r) => r.kind === "ai_visibility" && r.status === "done");
  const vis = latestVis?.summary as VisibilitySummary | undefined;

  const checks: { pillar: string; label: string; ok: boolean }[] = [
    { pillar: "Company", label: "Verified brand facts", ok: !!project.brand_facts?.trim() },
    { pillar: "Company", label: "Tone of voice", ok: !!project.tone_of_voice?.trim() },
    { pillar: "Company", label: "Brand documents uploaded", ok: (docs.count ?? 0) > 0 },
    { pillar: "Customers", label: "Target guests described", ok: !!project.target_customers?.trim() },
    { pillar: "Customers", label: "Local research run", ok: !!runs.data?.some((r) => r.kind === "local_context" && r.status === "done") },
    { pillar: "Competitors", label: "Competitors listed", ok: (project.competitors ?? []).length > 0 },
    { pillar: "Competitors", label: "AI visibility checked", ok: !!vis },
    { pillar: "Local", label: "Search location set", ok: !!(project.serp_location || project.city) && !!project.country_code },
  ];
  const done = checks.filter((c) => c.ok).length;

  return (
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
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">3C readiness</h3>
            <span className="text-sm text-ink-500">
              {done}/{checks.length}
            </span>
          </div>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full bg-brand-600" style={{ width: `${(done / checks.length) * 100}%` }} />
          </div>
          <ul className="space-y-2 text-sm">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-2">
                <span className={c.ok ? "text-emerald-400" : "text-ink-300"}>{c.ok ? "●" : "○"}</span>
                <span className="w-24 shrink-0 text-xs text-ink-500">{c.pillar}</span>
                <span className={c.ok ? "text-ink-800" : "text-ink-500"}>{c.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-500">The writer only uses facts it can find in the profile, documents, feedback rules and research, so more complete data means better rewrites.</p>
        </Card>

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
  );
}
