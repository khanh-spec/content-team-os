import "server-only";

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import type { AI } from "@/lib/ai";
import { brandProfile } from "@/lib/context";
import { buildBrief, type ContentBrief } from "@/lib/intel/brief";
import { analyseSerp } from "@/lib/intel/serp";
import { googleForums, googleSearch, localize } from "@/lib/serpapi";
import type { Project } from "@/lib/types";

const AiBriefSchema = z.object({
  angle: z.string().describe("The single strongest angle for this brand, in 1–2 sentences"),
  outline: z.array(z.object({ heading: z.string(), notes: z.array(z.string()) })).describe("Improved section outline (6–10 sections)"),
  intro: z.string().describe("A 60–90 word opening paragraph in the brand's voice that answers the query directly"),
  titleIdeas: z.array(z.string()).max(3),
  metaDescription: z.string().max(160),
});

/** SERP research → rule-based brief → optional AI refinement. */
export async function createBrief(ai: AI | null, project: Project, topic: string): Promise<ContentBrief> {
  const q = localize(topic, project);
  const [google, forums] = await Promise.all([googleSearch(q, project), googleForums(q, project).catch(() => [])]);
  const serp = analyseSerp(project, {
    query: q,
    organic: google.organic,
    questions: google.questions,
    relatedSearches: google.relatedSearches,
    localPack: google.localPack,
    aiOverview: google.aiOverview,
    answerBox: google.answerBox,
    forums: [...forums, ...google.discussions],
  });
  const brief = buildBrief(project, topic, serp);
  if (!ai) return brief;

  const res = await ai.client.responses.parse({
    model: ai.model,
    instructions:
      "You are the brand's senior SEO/GEO strategist. Improve the rule-based content brief: sharpen the angle, reorder and rename sections, and write the opening paragraph. " +
      "Use only facts from the brand profile and the brief; mark anything unverified as [confirm with client]. Follow the brand's English variant and tone.",
    input: `# Brand profile\n${brandProfile(project)}\n\n# Rule-based brief\n${JSON.stringify(brief)}`,
    text: { format: zodTextFormat(AiBriefSchema, "brief") },
  });
  const out = res.output_parsed;
  if (!out) return brief;
  return {
    ...brief,
    mode: "ai",
    outline: out.outline.length ? out.outline : brief.outline,
    titleIdeas: out.titleIdeas.length ? out.titleIdeas : brief.titleIdeas,
    metaDescription: out.metaDescription || brief.metaDescription,
    aiNotes: `**Angle:** ${out.angle}\n\n**Suggested intro:**\n\n${out.intro}`,
  };
}
