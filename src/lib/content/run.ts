import "server-only";

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import type { AI } from "@/lib/ai";
import { HttpError, must, type Supabase } from "@/lib/api";
import { brandProfile, loadProject, loadRules, rulesBlock } from "@/lib/context";
import { rewriteDraft } from "@/lib/content/rewrite";
import type { ContentBrief } from "@/lib/intel/brief";
import { optimiseContent, type OptimisationReport } from "@/lib/intel/optimise";
import { analyseSerp } from "@/lib/intel/serp";
import { googleSearch, localize } from "@/lib/serpapi";
import type { DraftAnalysis, DraftRow, Project, ResearchRun } from "@/lib/types";

/** Entities the live top results mention (1 SerpApi search). */
export async function serpEntities(project: Project, keyword: string): Promise<string[]> {
  const q = localize(keyword, project);
  const g = await googleSearch(q, project);
  const s = analyseSerp(project, { query: q, organic: g.organic, questions: g.questions, relatedSearches: g.relatedSearches, localPack: g.localPack });
  return s.topEntities.slice(0, 10).map((e) => e.name);
}

export async function ruleTexts(supabase: Supabase, projectId: string) {
  return (await loadRules(supabase, projectId)).map((r) => r.content);
}

export function reportIssues(report: OptimisationReport) {
  return report.checks
    .filter((c) => c.status !== "pass")
    .map((c) => `- [${c.area}] ${c.label}: ${c.detail}${c.fix ? ` Fix: ${c.fix}` : ""}`)
    .join("\n");
}

/** Rule-based checks (free) + optional AI rewrite that is told to fix the failed checks. */
export async function optimiseDraft(
  ai: AI | null,
  supabase: Supabase,
  project: Project,
  input: { title: string; content_type?: string | null; target_keyword?: string | null; original_content: string; instructions?: string | null; live_check?: boolean },
  opts: { runs: ResearchRun[]; compareSerp: boolean; aiRewrite: boolean; requiredEntities?: string[] },
): Promise<{ optimisation: OptimisationReport; revised: string | null; analysis: DraftAnalysis | null }> {
  const [rules, entities] = await Promise.all([
    ruleTexts(supabase, project.id),
    opts.requiredEntities ?? (opts.compareSerp && input.target_keyword ? serpEntities(project, input.target_keyword).catch(() => undefined) : Promise.resolve(undefined)),
  ]);
  const optimisation = optimiseContent(project, { content: input.original_content, keyword: input.target_keyword, requiredEntities: entities, rules });
  if (!ai || !opts.aiRewrite) return { optimisation, revised: null, analysis: null };

  const issues = reportIssues(optimisation);
  const { revised, analysis } = await rewriteDraft(
    ai,
    supabase,
    project,
    { ...input, instructions: [input.instructions, issues && `Fix these issues found by the checker:\n${issues}`].filter(Boolean).join("\n\n") },
    opts.runs,
  );
  return { optimisation, revised, analysis };
}

const DraftSchema = z.object({ content: z.string().describe("The full article in Markdown, starting with an H1") });

/** AI mode: write a first draft from a content brief. */
export async function generateFromBrief(ai: AI, supabase: Supabase, project: Project, brief: ContentBrief): Promise<string> {
  const rules = await loadRules(supabase, project.id);
  const res = await ai.client.responses.parse({
    model: ai.model,
    instructions:
      `Write a publish-ready article for ${project.brand_name} following the brief exactly. ` +
      `Use ${project.english_variant || "British English"}, the brand's tone, short paragraphs and question-led H2s where natural. ` +
      "Only use facts from the brand profile or brief; if a needed fact is marked MISSING, write around it and add [confirm with client]. " +
      "Open with a direct answer that names the brand and the destination. Include internal links from the brief as Markdown links. End with the preferred CTA.",
    input: `# Brand profile\n${brandProfile(project)}\n\n# Feedback rules\n${rulesBlock(rules)}\n\n# Brief\n${JSON.stringify(brief)}`,
    text: { format: zodTextFormat(DraftSchema, "draft") },
  });
  const content = res.output_parsed?.content;
  if (!content) throw new HttpError(502, "The model returned an empty draft");
  return content;
}

/** Re-run checks (and optionally the AI review) for a saved draft. */
export async function runDraftReview(
  ai: AI | null,
  supabase: Supabase,
  projectId: string,
  draftId: string,
  options: { instructions?: string | null; live_check?: boolean; aiRewrite?: boolean; compareSerp?: boolean },
) {
  const draft = must(await supabase.from("content_drafts").select("*").eq("id", draftId).eq("project_id", projectId).single()) as DraftRow;
  const project = await loadProject(supabase, projectId);
  const runs = draft.research_run_ids.length ? ((await supabase.from("research_runs").select("*").in("id", draft.research_run_ids).eq("status", "done")).data ?? []) : [];
  try {
    const result = await optimiseDraft(ai, supabase, project, { ...draft, ...options }, { runs: runs as ResearchRun[], compareSerp: !!options.compareSerp, aiRewrite: options.aiRewrite ?? true });
    const update: Record<string, unknown> = { optimisation: result.optimisation, error: null };
    if (result.revised) Object.assign(update, { revised_content: result.revised, analysis: result.analysis, status: "review" });
    else if (draft.status === "processing" || draft.status === "error") update.status = "draft";
    const { error } = await supabase.from("content_drafts").update(update).eq("id", draftId);
    if (error) throw new Error(error.message);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("content_drafts").update({ status: "error", error: message }).eq("id", draftId);
    throw new HttpError(502, message);
  }
}
