import { z } from "zod";
import { handle, must, parseBody, requireUser } from "@/lib/api";
import { runDraftReview } from "@/lib/content/run";

export const maxDuration = 300;

type Ctx = RouteContext<"/api/projects/[id]/drafts">;

const Body = z.object({
  title: z.string().trim().min(1).max(300),
  content_type: z.string().trim().nullish(),
  target_keyword: z.string().trim().nullish(),
  original_content: z.string().trim().min(20).max(120_000),
  research_run_ids: z.array(z.string().uuid()).max(6).default([]),
  instructions: z.string().trim().max(4_000).nullish(),
  live_check: z.boolean().default(false),
});

export const POST = handle<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  const { instructions, live_check, ...input } = await parseBody(req, Body);

  const draft = must(
    await supabase
      .from("content_drafts")
      .insert({ ...input, project_id: id, status: "processing", created_by: user.id })
      .select("id")
      .single(),
  );
  await runDraftReview(supabase, id, draft.id, { instructions, live_check });
  return { id: draft.id };
});
