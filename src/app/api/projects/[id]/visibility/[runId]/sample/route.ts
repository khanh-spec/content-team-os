import { z } from "zod";
import { HttpError, handle, must, parseBody, requireUser } from "@/lib/api";
import { requireAI } from "@/lib/ai";
import { loadProject } from "@/lib/context";
import { runChatGptSample, type VisibilityPlan } from "@/lib/research/visibility";

export const maxDuration = 180;

type Ctx = RouteContext<"/api/projects/[id]/visibility/[runId]/sample">;

const Body = z.object({ prompt_index: z.number().int().min(0), iteration: z.number().int().min(0) });

/** Step 2 (called once per prompt × iteration by the browser): one ChatGPT answer. */
export const POST = handle<Ctx>(async (req, ctx) => {
  const { id, runId } = await ctx.params;
  const { supabase } = await requireUser();
  const { prompt_index, iteration } = await parseBody(req, Body);
  const ai = await requireAI(supabase);
  const [project, run] = await Promise.all([
    loadProject(supabase, id),
    supabase.from("research_runs").select("params").eq("id", runId).eq("project_id", id).single().then(must),
  ]);
  const plan = run.params as VisibilityPlan;
  const prompt = plan.prompts[prompt_index]?.prompt;
  if (!prompt || iteration >= plan.iterations) throw new HttpError(400, "Sample out of range");

  let row;
  try {
    const result = await runChatGptSample(ai, project, prompt);
    row = { ...result, error: null };
  } catch (e) {
    row = { answer: null, mentions: null, citations: null, error: e instanceof Error ? e.message : String(e) };
  }
  const { error } = await supabase
    .from("visibility_samples")
    .upsert({ run_id: runId, prompt_index, iteration, prompt, ...row }, { onConflict: "run_id,prompt_index,iteration" });
  if (error) throw new Error(error.message);
  return { ok: !row.error, mentions: row.mentions?.length ?? 0, error: row.error };
});
