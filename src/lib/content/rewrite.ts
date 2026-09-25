import "server-only";

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import type { Supabase } from "@/lib/api";
import { brandProfile, chunksBlock, loadRules, retrieve, rulesBlock } from "@/lib/context";
import type { AI } from "@/lib/ai";
import type { LocalSummary } from "@/lib/research/local";
import type { VisibilitySummary } from "@/lib/research/visibility";
import type { DraftAnalysis, Project, ResearchRun } from "@/lib/types";

const DraftResultSchema = z.object({
  revised_content: z.string().describe("The full revised content in Markdown, ready to publish"),
  summary: z.string().describe("2-3 sentences on what changed and why"),
  fact_checks: z.array(
    z.object({
      original: z.string().describe("Exact text from the original draft"),
      issue: z.string(),
      correction: z.string(),
      type: z.enum(["brand_fact", "competitor_name", "brand_name", "local_fact", "unverifiable", "other"]),
      severity: z.enum(["high", "medium", "low"]),
      evidence: z.string().describe("Which source supports the correction: [D#], brand facts, feedback rule, research, web check — or 'no source found'"),
    }),
  ),
  changes: z.array(z.object({ before: z.string(), after: z.string(), reason: z.string() })).describe("Most important edits (max 15)"),
  added_facts: z.array(z.object({ fact: z.string(), source: z.string() })).describe("Brand/local facts newly woven in, with source"),
  tone_notes: z.array(z.string()),
  questions_for_client: z.array(z.string()).describe("Facts that must be confirmed by the client before publishing"),
  seo_geo_notes: z.array(z.string()).describe("Entity, keyword, question coverage and AI-citability notes"),
});

export type RewriteInput = {
  title: string;
  content_type?: string | null;
  target_keyword?: string | null;
  original_content: string;
  instructions?: string | null;
  live_check?: boolean;
};

const STYLE_RULES = `
Writing rules:
- Keep the author's structure, intent and length (±15%) unless a rule or instruction says otherwise.
- Sound like a knowledgeable local, not an ad: concrete details (names, distances, times, prices, seasons) beat adjectives.
- Avoid filler and AI clichés: "nestled", "hidden gem", "boasts", "tapestry", "vibrant", "whether you're… or…", "look no further", "elevate", "unforgettable experience", "in the heart of" (unless literally true and useful).
- Use natural phrasing guests actually use (see customer vocabulary if provided).
- Brand and competitor names must use the exact official spelling from the brand profile.
- Only state facts supported by the brand profile, documents [D#], feedback rules, research data, or the web check. Never invent awards, numbers, amenities or distances. If a useful fact is missing, keep the sentence general and add a question for the client.
- Feedback rules override everything else except factual accuracy.
- Answer the questions real customers ask where it fits naturally (GEO: clear, quotable, self-contained sentences that AI assistants can cite).
`;

function researchBlock(runs: ResearchRun[]): string {
  const parts: string[] = [];
  for (const r of runs) {
    if (r.kind === "local_context" && r.summary) {
      const s = r.summary as LocalSummary;
      parts.push(
        [
          `### Local context research: "${r.query}"`,
          `Overview: ${s.overview}`,
          `Customer questions:\n${s.customer_questions.slice(0, 15).map((q) => `- ${q.question} (${q.source})`).join("\n")}`,
          `Customer vocabulary: ${s.customer_vocabulary.join("; ")}`,
          `Local facts:\n${s.local_facts.map((f) => `- ${f.fact} [${f.source}, ${f.confidence}]`).join("\n")}`,
          `Brand perception: ${s.brand_perception.summary}`,
          `Competitors:\n${s.competitor_insights.map((c) => `- ${c.name}: ${c.positioning}`).join("\n")}`,
        ].join("\n"),
      );
    }
    if (r.kind === "ai_visibility" && r.summary) {
      const s = r.summary as VisibilitySummary;
      parts.push(
        [
          `### AI visibility check: "${r.query}"`,
          `Brand mention rate in ChatGPT: ${Math.round((s.brand?.ai_mention_rate ?? 0) * 100)}%`,
          `Businesses ChatGPT recommends most: ${s.businesses.slice(0, 8).map((b) => `${b.name} (${Math.round(b.ai_mention_rate * 100)}%)`).join(", ")}`,
          `Most cited domains: ${s.citation_domains.slice(0, 8).map((d) => d.domain).join(", ")}`,
        ].join("\n"),
      );
    }
  }
  return parts.join("\n\n") || "No research runs attached.";
}

/** Web-search pass that verifies claims about the brand, competitors and area. */
async function liveFactCheck(ai: AI, project: Project, content: string): Promise<string> {
  const res = await ai.client.responses.create({
    model: ai.model,
    tools: [{ type: "web_search", user_location: { type: "approximate", city: project.city || undefined, country: project.country_code?.toUpperCase() || undefined } }],
    instructions:
      "You are a meticulous fact-checker. List every checkable factual claim in the draft about the brand, named competitors, " +
      "local places, distances, opening hours, prices, events or history. Verify each with web search. " +
      "Return a concise list: claim → verdict (correct / incorrect / outdated / unverified) → correct information → source URL. " +
      "Also flag misspelled business or place names.",
    input: `Brand: ${project.brand_name}${project.website ? ` (${project.website})` : ""}, ${project.city ?? ""} ${project.country ?? ""}\nCompetitors: ${(project.competitors ?? []).map((c) => c.name).join(", ") || "none"}\n\nDraft:\n${content.slice(0, 30_000)}`,
  });
  return res.output_text || "";
}

export async function rewriteDraft(
  ai: AI,
  supabase: Supabase,
  project: Project,
  input: RewriteInput,
  runs: ResearchRun[],
): Promise<{ revised: string; analysis: DraftAnalysis }> {
  const paragraphs = input.original_content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 40);
  const queries = [
    [input.title, input.target_keyword].filter(Boolean).join(" — "),
    ...paragraphs.slice(0, 7).map((p) => p.slice(0, 600)),
  ];

  const [chunks, rules, webCheck] = await Promise.all([
    retrieve(supabase, ai, project.id, queries),
    loadRules(supabase, project.id),
    input.live_check ? liveFactCheck(ai, project, input.original_content).catch((e: Error) => `Web check failed: ${e.message}`) : Promise.resolve(""),
  ]);

  const prompt = [
    `# Brand profile (3C)\n${brandProfile(project)}`,
    `# Feedback rules from past reviews (must follow)\n${rulesBlock(rules)}`,
    `# Relevant passages from brand documents\n${chunksBlock(chunks)}`,
    `# Market research\n${researchBlock(runs)}`,
    webCheck ? `# Live web fact-check results\n${webCheck}` : "",
    `# Assignment`,
    `Title: ${input.title}`,
    input.content_type ? `Content type: ${input.content_type}` : "",
    input.target_keyword ? `Target keyword / topic: ${input.target_keyword}` : "",
    input.instructions ? `Extra instructions from the writer: ${input.instructions}` : "",
    `\n# Original draft\n${input.original_content}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await ai.client.responses.parse({
    model: ai.model,
    instructions:
      `You are the brand-specific senior editor for ${project.brand_name}, a ${project.property_type ?? project.industry.toLowerCase()} in ${project.city ?? "its destination"}. ` +
      "You know the brand (Company), its guests (Customers) and its market (Competitors). " +
      "Fact-check the draft against the sources, fix wrong brand/competitor names and facts, weave in relevant verified brand facts, " +
      "and rewrite it in the brand's tone of voice with natural wording.\n" +
      STYLE_RULES,
    input: prompt,
    text: { format: zodTextFormat(DraftResultSchema, "draft_review") },
  });

  const out = res.output_parsed;
  if (!out) throw new Error("The model did not return a revision");

  const { revised_content, ...rest } = out;
  return {
    revised: revised_content,
    analysis: {
      ...rest,
      context_used: {
        documents: [...new Set(chunks.map((c) => c.title))],
        research: runs.map((r) => `${r.kind === "local_context" ? "Local research" : "AI visibility"}: ${r.query}`),
        rules: rules.length,
      },
    },
  };
}
