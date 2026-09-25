import { z } from "zod";
import { getAI } from "@/lib/ai";
import { handle, must, parseBody, requireUser } from "@/lib/api";
import { loadProject } from "@/lib/context";
import { PREVIEW } from "@/lib/env";
import { LOCAL_SOURCES, type LocalSourceId } from "@/lib/research/local";
import { runLocalResearch } from "@/lib/research/run";

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
  const [project, ai] = await Promise.all([loadProject(supabase, id), getAI(supabase)]);
  const params = { sources, mode: ai ? "ai" : "free" };

  // Preview mode: nothing to save to, so return the finished run directly.
  if (PREVIEW) {
    const result = await runLocalResearch(ai, project, topic, sources);
    const now = new Date().toISOString();
    return { run: { id: "preview", project_id: id, kind: "local_context", query: topic, params, status: "done", ...result, error: null, created_at: now, completed_at: now } };
  }

  const run = must(
    await supabase.from("research_runs").insert({ project_id: id, kind: "local_context", query: topic, params, created_by: user.id }).select("id").single(),
  );
  try {
    const { sources: collected, summary } = await runLocalResearch(ai, project, topic, sources);
    await supabase.from("research_runs").update({ sources: collected, summary, status: "done", completed_at: new Date().toISOString() }).eq("id", run.id);
    return { id: run.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("research_runs").update({ status: "error", error: message }).eq("id", run.id);
    throw e;
  }
});
