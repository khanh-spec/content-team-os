import { FeedbackExtractor, FeedbackLog } from "@/components/feedback";
import { getAI } from "@/lib/ai";
import { SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { FeedbackRow } from "@/lib/types";

export default async function FeedbackPage({ params }: PageProps<"/projects/[id]/feedback">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, { data: drafts }, ai] = await Promise.all([
    supabase.from("feedback_logs").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("content_drafts").select("id, title").eq("project_id", id).order("created_at", { ascending: false }).limit(50),
    getAI(supabase),
  ]);
  return (
    <div>
      <SectionTitle
        title="Feedback Intelligence"
        description="Every client and editor comment in one place. Rules learned from feedback are enforced by the checker and followed by the AI writer on every future draft."
      />
      <div className="mb-6">
        <FeedbackExtractor projectId={id} aiEnabled={!!ai} />
      </div>
      <FeedbackLog projectId={id} items={(data ?? []) as FeedbackRow[]} drafts={drafts ?? []} />
    </div>
  );
}
