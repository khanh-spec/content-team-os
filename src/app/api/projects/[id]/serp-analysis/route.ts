import { z } from "zod";
import { handle, parseBody, requireUser } from "@/lib/api";
import { loadProject } from "@/lib/context";
import { analyseSerp } from "@/lib/intel/serp";
import { googleSearch, localize } from "@/lib/serpapi";

export const maxDuration = 60;

type Ctx = RouteContext<"/api/projects/[id]/serp-analysis">;

const Body = z.object({ query: z.string().trim().min(2).max(300) });

/** Search Opportunity Map for one query (1 SerpApi search, no AI). */
export const POST = handle<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  const { supabase } = await requireUser();
  const { query } = await parseBody(req, Body);
  const project = await loadProject(supabase, id);
  const q = localize(query, project);
  const g = await googleSearch(q, project);
  const insight = analyseSerp(project, {
    query,
    organic: g.organic,
    questions: g.questions,
    relatedSearches: g.relatedSearches,
    localPack: g.localPack,
    aiOverview: g.aiOverview,
    answerBox: g.answerBox,
    forums: g.discussions,
  });
  return { insight };
});
