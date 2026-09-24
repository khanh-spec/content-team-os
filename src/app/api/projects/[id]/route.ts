import { handle, must, parseBody, requireUser } from "@/lib/api";
import { ProjectInputSchema } from "@/lib/schemas";

type Ctx = RouteContext<"/api/projects/[id]">;

export const PATCH = handle<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  const { supabase } = await requireUser();
  const input = await parseBody(req, ProjectInputSchema.partial());
  must(await supabase.from("projects").update(input).eq("id", id).select("id").single());
  return { ok: true };
});

export const DELETE = handle<Ctx>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const { supabase } = await requireUser();
  const { data: files } = await supabase.storage.from("brand-files").list(id, { limit: 1000 });
  if (files?.length) {
    await supabase.storage.from("brand-files").remove(files.map((f) => `${id}/${f.name}`));
  }
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
});
