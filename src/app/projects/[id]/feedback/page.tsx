import { FeedbackLog } from "@/components/feedback";
import { SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { FeedbackRow } from "@/lib/types";

export default async function FeedbackPage({ params }: PageProps<"/projects/[id]/feedback">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, { data: drafts }] = await Promise.all([
    supabase.from("feedback_logs").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("content_drafts").select("id, title").eq("project_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  return (
    <div>
      <SectionTitle
        title="Feedback Log"
        description="Every client and editor comment in one place. Turn recurring feedback into rules and the writer applies them to every future draft."
      />
      <FeedbackLog projectId={id} items={(data ?? []) as FeedbackRow[]} drafts={drafts ?? []} />
    </div>
  );
}
