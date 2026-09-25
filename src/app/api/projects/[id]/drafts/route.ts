import { z } from "zod";
import { getAI, requireAI } from "@/lib/ai";
import { handle, must, parseBody, requireUser } from "@/lib/api";
import { generateFromBrief, optimiseDraft } from "@/lib/content/run";
import { loadProject } from "@/lib/context";
import { PREVIEW } from "@/lib/env";
import type { ContentBrief } from "@/lib/intel/brief";
import type { ResearchRun } from "@/lib/types";

export const maxDuration = 300;

type Ctx = RouteContext<"/api/projects/[id]/drafts">;

const Optimise = z.object({
  mode: z.literal("optimise").default("optimise"),
  title: z.string().trim().min(1).max(300),
  content_type: z.string().trim().nullish(),
  target_keyword: z.string().trim().nullish(),
  original_content: z.string().trim().min(20).max(120_000),
  research_run_ids: z.array(z.string().uuid()).max(6).default([]),
  instructions: z.string().trim().max(4_000).nullish(),
  live_check: z.boolean().default(false),
  compare_serp: z.boolean().default(false),
  ai_rewrite: z.boolean().default(false),
});
const Generate = z.object({ mode: z.literal("generate"), brief: z.record(z.string(), z.unknown()) });
const Body = z.union([Generate, Optimise]);

export const POST = handle<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  const body = await parseBody(req, Body);
  const project = await loadProject(supabase, id);

  if (body.mode === "generate") {
    const ai = await requireAI(supabase);
    const brief = body.brief as unknown as ContentBrief;
    const content = await generateFromBrief(ai, supabase, project, brief);
    const input = { title: brief.titleIdeas?.[0] ?? brief.topic, content_type: "Blog article", target_keyword: brief.topic, original_content: content };
    const { optimisation } = await optimiseDraft(null, supabase, project, input, { runs: [], compareSerp: false, aiRewrite: false, requiredEntities: brief.requiredEntities?.map((e) => e.name) });
    if (PREVIEW) return { draft: previewDraft(id, { ...input, optimisation }) };
    const row = must(await supabase.from("content_drafts").insert({ ...input, project_id: id, status: "draft", optimisation, created_by: user.id }).select("id").single());
    return { id: row.id };
  }

  const { instructions, live_check, compare_serp, ai_rewrite, mode: _m, ...input } = body;
  void _m;
  const ai = ai_rewrite ? await requireAI(supabase) : await getAI(supabase);
  const runs = input.research_run_ids.length && !PREVIEW ? ((await supabase.from("research_runs").select("*").in("id", input.research_run_ids).eq("status", "done")).data ?? []) : [];
  const result = await optimiseDraft(ai, supabase, project, { ...input, instructions, live_check }, { runs: runs as ResearchRun[], compareSerp: compare_serp, aiRewrite: ai_rewrite });

  const row = {
    ...input,
    optimisation: result.optimisation,
    revised_content: result.revised,
    analysis: result.analysis,
    status: result.revised ? "review" : "draft",
  };
  if (PREVIEW) return { draft: previewDraft(id, row) };
  const draft = must(await supabase.from("content_drafts").insert({ ...row, project_id: id, created_by: user.id }).select("id").single());
  return { id: draft.id };
});

function previewDraft(projectId: string, row: Record<string, unknown>) {
  const now = new Date().toISOString();
  return { id: "preview", project_id: projectId, research_run_ids: [], revised_content: null, analysis: null, status: "draft", error: null, created_at: now, updated_at: now, ...row };
}
