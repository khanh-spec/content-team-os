import "server-only";

import { HttpError, must, type Supabase } from "@/lib/api";
import { loadProject } from "@/lib/context";
import { rewriteDraft } from "@/lib/content/rewrite";
import type { DraftRow, ResearchRun } from "@/lib/types";

/** Load a draft + its research, run the brand review, and persist the result. */
export async function runDraftReview(
  supabase: Supabase,
  projectId: string,
  draftId: string,
  options: { instructions?: string | null; live_check?: boolean },
) {
  const draft = must(
    await supabase.from("content_drafts").select("*").eq("id", draftId).eq("project_id", projectId).single(),
  ) as DraftRow;
  const project = await loadProject(supabase, projectId);
  const runs = draft.research_run_ids.length
    ? ((await supabase.from("research_runs").select("*").in("id", draft.research_run_ids).eq("status", "done")).data ?? [])
    : [];

  try {
    const { revised, analysis } = await rewriteDraft(
      supabase,
      project,
      { ...draft, ...options },
      runs as ResearchRun[],
    );
    const { error } = await supabase
      .from("content_drafts")
      .update({ revised_content: revised, analysis, status: "review", error: null })
      .eq("id", draftId);
    if (error) throw new Error(error.message);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("content_drafts").update({ status: "error", error: message }).eq("id", draftId);
    throw new HttpError(502, message);
  }
}
