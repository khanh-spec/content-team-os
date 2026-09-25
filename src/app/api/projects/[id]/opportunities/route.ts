import { getAI } from "@/lib/ai";
import { HttpError, handle, must, requireUser } from "@/lib/api";
import { PREVIEW } from "@/lib/env";
import { freeOpportunityReport } from "@/lib/intel/plan";
import { loadProject } from "@/lib/context";
import { classify, type GscRow } from "@/lib/gsc/opportunities";
import { buildOpportunityReport } from "@/lib/gsc/report";
import type { LocalSummary } from "@/lib/research/local";
import type { VisibilitySummary } from "@/lib/research/visibility";

export const maxDuration = 300;

type Ctx = RouteContext<"/api/projects/[id]/opportunities">;

/** Build a 3C content plan from GSC queries + the latest research runs. */
export const POST = handle<Ctx>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  const project = await loadProject(supabase, id);
  const [queries, runs] = await Promise.all([
    supabase.from("gsc_queries").select("query, page, clicks, impressions, ctr, position").eq("project_id", id).limit(5000).then(must),
    supabase
      .from("research_runs")
      .select("kind, summary")
      .eq("project_id", id)
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(6)
      .then(must),
  ]);
  if (!queries.length) throw new HttpError(400, "Import Search Console data first");

  const opportunities = classify(queries as GscRow[], project);
  const ai = await getAI(supabase);
  const report = !ai
    ? freeOpportunityReport(project, opportunities)
    : await buildOpportunityReport(
    ai,
    project,
    opportunities,
    runs
      .filter((r) => r.kind === "local_context")
      .map((r) => {
        const sm = r.summary as { ai?: LocalSummary } & Partial<LocalSummary>;
        return sm?.ai ?? (sm?.customer_questions ? (sm as LocalSummary) : null);
      })
      .filter((x): x is LocalSummary => !!x),
    runs.filter((r) => r.kind === "ai_visibility").map((r) => r.summary as VisibilitySummary),
  );
  if (PREVIEW) return { report: { report, created_at: new Date().toISOString() } };
  const row = must(
    await supabase.from("opportunity_reports").insert({ project_id: id, report, created_by: user.id }).select("id").single(),
  );
  return { id: row.id };
});
