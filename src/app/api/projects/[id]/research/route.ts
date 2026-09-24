import { z } from "zod";
import { handle, must, parseBody, requireUser } from "@/lib/api";
import { loadProject } from "@/lib/context";
import { LOCAL_SOURCES, collectLocalSources, synthesizeLocal, type LocalSourceId } from "@/lib/research/local";

export const maxDuration = 300;

type Ctx = RouteContext<"/api/projects/[id]/research">;

const ids = LOCAL_SOURCES.map((s) => s.id) as [LocalSourceId, ...LocalSourceId[]];
const Body = z.object({
  topic: z.string().trim().min(2).max(300),
  sources: z.array(z.enum(ids)).min(1).default([...ids]),
});

export const POST = handle<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  const { topic, sources } = await parseBody(req, Body);
  const project = await loadProject(supabase, id);

  const run = must(
    await supabase
      .from("research_runs")
      .insert({ project_id: id, kind: "local_context", query: topic, params: { sources }, created_by: user.id })
      .select("id")
      .single(),
  );

  try {
    const collected = await collectLocalSources(project, topic, sources);
    await supabase.from("research_runs").update({ sources: collected }).eq("id", run.id);
    const summary = await synthesizeLocal(project, topic, collected);
    await supabase
      .from("research_runs")
      .update({ summary, status: "done", completed_at: new Date().toISOString() })
      .eq("id", run.id);
    return { id: run.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("research_runs").update({ status: "error", error: message }).eq("id", run.id);
    throw e;
  }
});
