import { z } from "zod";
import { handle, must, parseBody, requireUser } from "@/lib/api";
import { requireAI } from "@/lib/ai";
import { loadProject } from "@/lib/context";
import { generateFanout, serpBaseline, type VisibilityPlan } from "@/lib/research/visibility";

export const maxDuration = 120;

type Ctx = RouteContext<"/api/projects/[id]/visibility">;

const Body = z.object({
  seed: z.string().trim().min(2).max(300),
  prompts: z.number().int().min(1).max(12).default(5),
  iterations: z.number().int().min(1).max(5).default(3),
});

/** Step 1: create the run, generate fan-out prompts and fetch the SerpApi baseline. */
export const POST = handle<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  const { seed, prompts, iterations } = await parseBody(req, Body);
  const ai = await requireAI(supabase);
  const project = await loadProject(supabase, id);

  const [fanout, baseline] = await Promise.all([generateFanout(ai, project, seed, prompts), serpBaseline(project, seed)]);
  const plan: VisibilityPlan = { prompts: fanout, iterations };

  const run = must(
    await supabase
      .from("research_runs")
      .insert({
        project_id: id,
        kind: "ai_visibility",
        query: seed,
        params: plan,
        sources: { baseline },
        created_by: user.id,
      })
      .select("id")
      .single(),
  );
  return { id: run.id, plan };
});
