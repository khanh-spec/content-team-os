import "server-only";

import type { AI } from "@/lib/ai";
import { analyseSerp, type SerpInsight } from "@/lib/intel/serp";
import { collectLocalSources, synthesizeLocal, type LocalSourceId, type LocalSources, type LocalSummary } from "@/lib/research/local";
import type { Project } from "@/lib/types";

export type ResearchSummary = { rules: SerpInsight; ai?: LocalSummary; aiError?: string };

/** Free analysis always; AI synthesis on top when AI Enhanced mode is on. */
export async function runLocalResearch(ai: AI | null, project: Project, topic: string, enabled: LocalSourceId[]) {
  const sources: LocalSources = await collectLocalSources(project, topic, enabled);
  const rules = analyseSerp(project, {
    query: sources.query,
    organic: sources.organic,
    questions: sources.questions,
    relatedSearches: sources.relatedSearches,
    localPack: sources.localPack,
    maps: sources.maps,
    aiOverview: sources.aiOverview,
    answerBox: sources.answerBox ?? null,
    forums: sources.forums,
    reddit: sources.reddit,
    booking: sources.booking,
    tripadvisor: sources.tripadvisor,
    reviews: sources.reviews,
  });
  const summary: ResearchSummary = { rules };
  if (ai) {
    try {
      summary.ai = await synthesizeLocal(ai, project, topic, sources);
    } catch (e) {
      summary.aiError = e instanceof Error ? e.message : String(e);
    }
  }
  return { sources, summary };
}
