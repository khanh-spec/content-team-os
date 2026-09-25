import { z } from "zod";
import { handle, parseBody, requireUser } from "@/lib/api";
import { getAI } from "@/lib/ai";
import { loadProject } from "@/lib/context";
import { optimiseContent } from "@/lib/intel/optimise";
import { ruleTexts, runDraftReview } from "@/lib/content/run";
import { MANUAL_STATUSES } from "@/lib/pipeline";

export const maxDuration = 300;

type Ctx = RouteContext<"/api/projects/[id]/drafts/[draftId]">;

const Patch = z.object({
  title: z.string().trim().min(1).optional(),
  revised_content: z.string().optional(),
  original_content: z.string().min(20).optional(),
  status: z.enum(MANUAL_STATUSES).optional(),
});

export const PATCH = handle<Ctx>(async (req, ctx) => {
  const { id, draftId } = await ctx.params;
  const { supabase } = await requireUser();
  const input = await parseBody(req, Patch);
  const update: Record<string, unknown> = { ...input };
  // Editing the text re-runs the free checks straight away.
  if (input.original_content) {
    const [project, rules, current] = await Promise.all([
      loadProject(supabase, id),
      ruleTexts(supabase, id),
      supabase.from("content_drafts").select("target_keyword, optimisation").eq("id", draftId).single(),
    ]);
    const previous = current.data?.optimisation as { requiredEntities?: string[] } | null;
    update.optimisation = optimiseContent(project, { content: input.original_content, keyword: current.data?.target_keyword, rules, requiredEntities: previous?.requiredEntities });
  }
  const { error } = await supabase.from("content_drafts").update(update).eq("id", draftId).eq("project_id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
});

const Rerun = z.object({
  instructions: z.string().trim().max(4_000).nullish(),
  live_check: z.boolean().default(false),
  ai_rewrite: z.boolean().default(true),
  compare_serp: z.boolean().default(false),
  research_run_ids: z.array(z.string().uuid()).max(6).optional(),
});

/** Re-run the review (e.g. after adding documents or feedback rules). */
export const POST = handle<Ctx>(async (req, ctx) => {
  const { id, draftId } = await ctx.params;
  const { supabase } = await requireUser();
  const { research_run_ids, ai_rewrite, compare_serp, ...options } = await parseBody(req, Rerun);
  const ai = ai_rewrite ? await getAI(supabase) : null;
  await supabase
    .from("content_drafts")
    .update({ status: "processing", error: null, ...(research_run_ids ? { research_run_ids } : {}) })
    .eq("id", draftId)
    .eq("project_id", id);
  await runDraftReview(ai, supabase, id, draftId, { ...options, aiRewrite: !!ai && ai_rewrite, compareSerp: compare_serp });
  return { ok: true };
});

export const DELETE = handle<Ctx>(async (_req, ctx) => {
  const { id, draftId } = await ctx.params;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("content_drafts").delete().eq("id", draftId).eq("project_id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
});
