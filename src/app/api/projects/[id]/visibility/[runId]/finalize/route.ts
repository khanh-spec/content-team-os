import { handle, must, requireUser } from "@/lib/api";
import { loadProject } from "@/lib/context";
import { aggregate, visibilityInsights, type Sample, type SerpBaseline, type VisibilityPlan } from "@/lib/research/visibility";

export const maxDuration = 120;

type Ctx = RouteContext<"/api/projects/[id]/visibility/[runId]/finalize">;

/** Step 3: aggregate samples vs SERP baseline and write recommendations. */
export const POST = handle<Ctx>(async (_req, ctx) => {
  const { id, runId } = await ctx.params;
  const { supabase } = await requireUser();
  const [project, run, samples] = await Promise.all([
    loadProject(supabase, id),
    supabase.from("research_runs").select("*").eq("id", runId).eq("project_id", id).single().then(must),
    supabase
      .from("visibility_samples")
      .select("prompt_index, iteration, prompt, answer, mentions, citations, error")
      .eq("run_id", runId)
      .then(must),
  ]);
  const plan = run.params as VisibilityPlan;
  const baseline = (run.sources as { baseline: SerpBaseline }).baseline;
  const summary = aggregate(project, plan, baseline, samples as Sample[]);
  summary.insights = await visibilityInsights(project, run.query, summary).catch(() => undefined);

  const { error } = await supabase
    .from("research_runs")
    .update({ summary, status: "done", completed_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) throw new Error(error.message);
  return { ok: true };
});
