import { handle, must, parseBody, requireUser } from "@/lib/api";
import { FeedbackSchema } from "@/lib/schemas";

type Ctx = RouteContext<"/api/projects/[id]/feedback">;


export const POST = handle<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  const input = await parseBody(req, FeedbackSchema);
  const row = must(
    await supabase
      .from("feedback_logs")
      .insert({ ...input, project_id: id, created_by: user.id })
      .select("id")
      .single(),
  );
  return { id: row.id };
});
