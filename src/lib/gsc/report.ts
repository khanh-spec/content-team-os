import "server-only";

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { brandProfile } from "@/lib/context";
import type { AI } from "@/lib/ai";
import type { Opportunity } from "@/lib/gsc/opportunities";
import type { LocalSummary } from "@/lib/research/local";
import type { VisibilitySummary } from "@/lib/research/visibility";
import type { Project } from "@/lib/types";

export const OpportunityReportSchema = z.object({
  summary: z.string(),
  briefs: z.array(
    z.object({
      title: z.string().describe("Working title of the page or content update"),
      action: z.enum(["new_page", "update_existing", "faq_block", "title_meta_rewrite", "comparison_page", "local_guide"]),
      pillar: z.enum(["company", "customers", "competitors"]),
      primary_query: z.string(),
      supporting_queries: z.array(z.string()),
      target_page: z.string().describe("Existing URL to update, or 'new'"),
      customer_questions: z.array(z.string()).describe("Questions to answer, from GSC + research"),
      brand_facts_to_use: z.array(z.string()).describe("Which verified brand facts prove the point; say 'MISSING: …' for facts the client must supply"),
      competitor_angle: z.string().describe("How to position vs competitors, if relevant"),
      geo_note: z.string().describe("How this helps AI assistants cite/recommend the brand"),
      priority: z.enum(["high", "medium", "low"]),
    }),
  ),
  missing_brand_facts: z.array(z.string()).describe("Facts the brand should document because searchers/AI need them"),
});
export type OpportunityReport = z.infer<typeof OpportunityReportSchema>;

export async function buildOpportunityReport(
  ai: AI,
  project: Project,
  opportunities: Opportunity[],
  local: LocalSummary[],
  visibility: VisibilitySummary[],
): Promise<OpportunityReport> {
  const top = opportunities.slice(0, 80).map((o) => ({
    q: o.query,
    page: o.page,
    clicks: o.clicks,
    impr: o.impressions,
    pos: o.position ? Math.round(o.position * 10) / 10 : null,
    pillar: o.pillar,
    tail: o.tail,
    signals: o.signals,
  }));
  const research = {
    customer_questions: local.flatMap((l) => l.customer_questions.map((q) => q.question)).slice(0, 40),
    content_angles: local.flatMap((l) => l.content_angles).slice(0, 15),
    ai_visibility: visibility.map((v) => ({
      brand_rate: v.brand?.ai_mention_rate ?? 0,
      leaders: v.businesses.slice(0, 5).map((b) => b.name),
      cited_domains: v.citation_domains.slice(0, 8).map((d) => d.domain),
    })),
  };

  const res = await ai.client.responses.parse({
    model: ai.model,
    instructions:
      "You are the content strategist for a single hospitality brand. Turn Search Console data into a prioritized content plan using the 3C framework: " +
      "COMPANY (branded + fact queries → make brand facts explicit and quotable), CUSTOMERS (long-tail questions and local-intent queries → answer them with first-hand local knowledge), " +
      "COMPETITORS (competitor-name and comparison queries → honest comparison content where the brand has a provable edge). " +
      "Group related queries into one brief (avoid cannibalization), prefer updating ranking pages over new pages, and only claim brand facts listed in the profile.",
    input: `# Brand profile\n${brandProfile(project)}\n\n# Search Console opportunities (pre-classified)\n${JSON.stringify(top)}\n\n# Market research\n${JSON.stringify(research)}`,
    text: { format: zodTextFormat(OpportunityReportSchema, "opportunity_report") },
  });
  if (!res.output_parsed) throw new Error("The model did not return a report");
  return res.output_parsed;
}
