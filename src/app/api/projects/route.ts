import { handle, must, parseBody, requireUser } from "@/lib/api";
import { ProjectInputSchema } from "@/lib/schemas";

export const POST = handle(async (req) => {
  const { supabase, user } = await requireUser();
  const input = await parseBody(req, ProjectInputSchema);
  const project = must(
    await supabase.from("projects").insert({ ...input, created_by: user.id }).select("id").single(),
  );
  return { id: project.id };
});
