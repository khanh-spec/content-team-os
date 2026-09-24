import { z } from "zod";
import { handle, parseBody, requireUser } from "@/lib/api";
import { runDraftReview } from "@/lib/content/run";

export const maxDuration = 300;

type Ctx = RouteContext<"/api/projects/[id]/drafts/[draftId]">;

const Patch = z.object({
  title: z.string().trim().min(1).optional(),
  revised_content: z.string().optional(),
  original_content: z.string().min(20).optional(),
  status: z.enum(["draft", "reviewed", "approved"]).optional(),
});

export const PATCH = handle<Ctx>(async (req, ctx) => {
  const { id, draftId } = await ctx.params;
  const { supabase } = await requireUser();
  const input = await parseBody(req, Patch);
  const { error } = await supabase.from("content_drafts").update(input).eq("id", draftId).eq("project_id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
});

const Rerun = z.object({
  instructions: z.string().trim().max(4_000).nullish(),
  live_check: z.boolean().default(false),
  research_run_ids: z.array(z.string().uuid()).max(6).optional(),
});

/** Re-run the review (e.g. after adding documents or feedback rules). */
export const POST = handle<Ctx>(async (req, ctx) => {
  const { id, draftId } = await ctx.params;
  const { supabase } = await requireUser();
  const { research_run_ids, ...options } = await parseBody(req, Rerun);
  await supabase
    .from("content_drafts")
    .update({ status: "processing", error: null, ...(research_run_ids ? { research_run_ids } : {}) })
    .eq("id", draftId)
    .eq("project_id", id);
  await runDraftReview(supabase, id, draftId, options);
  return { ok: true };
});

export const DELETE = handle<Ctx>(async (_req, ctx) => {
  const { id, draftId } = await ctx.params;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("content_drafts").delete().eq("id", draftId).eq("project_id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
});
