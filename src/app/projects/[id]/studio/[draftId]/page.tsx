import { notFound } from "next/navigation";
import { DraftView } from "@/components/draft-view";
import { getAI } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import type { DraftRow, FeedbackRow } from "@/lib/types";

export default async function DraftPage({ params }: PageProps<"/projects/[id]/studio/[draftId]">) {
  const { id, draftId } = await params;
  const supabase = await createClient();
  const [{ data: draft }, { data: feedback }, { data: runs }] = await Promise.all([
    supabase.from("content_drafts").select("*").eq("id", draftId).eq("project_id", id).maybeSingle(),
    supabase.from("feedback_logs").select("*").eq("draft_id", draftId).order("created_at", { ascending: false }),
    supabase.from("research_runs").select("id, kind, query, created_at").eq("project_id", id).eq("status", "done").order("created_at", { ascending: false }).limit(20),
  ]);
  if (!draft) notFound();
  const ai = await getAI(supabase);
  return <DraftView projectId={id} draft={draft as DraftRow} feedback={(feedback ?? []) as FeedbackRow[]} runs={runs ?? []} aiEnabled={!!ai} />;
}
