import { handle, requireUser } from "@/lib/api";

type Ctx = RouteContext<"/api/projects/[id]/runs/[runId]">;

export const DELETE = handle<Ctx>(async (_req, ctx) => {
  const { id, runId } = await ctx.params;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("research_runs").delete().eq("id", runId).eq("project_id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
});
