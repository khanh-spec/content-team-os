import { z } from "zod";
import { getAI } from "@/lib/ai";
import { handle, must, parseBody, requireUser } from "@/lib/api";
import { createBrief } from "@/lib/content/brief";
import { loadProject } from "@/lib/context";
import { PREVIEW } from "@/lib/env";

export const maxDuration = 120;

type Ctx = RouteContext<"/api/projects/[id]/briefs">;

const Body = z.object({ topic: z.string().trim().min(2).max(300) });

export const POST = handle<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  const { topic } = await parseBody(req, Body);
  const [project, ai] = await Promise.all([loadProject(supabase, id), getAI(supabase)]);
  const brief = await createBrief(ai, project, topic);
  if (PREVIEW) return { brief };
  const row = must(await supabase.from("content_briefs").insert({ project_id: id, topic, mode: brief.mode, brief, created_by: user.id }).select("id").single());
  return { id: row.id };
});
