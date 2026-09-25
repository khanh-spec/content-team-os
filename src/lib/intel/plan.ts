// Free-mode 3C content plan from classified Search Console queries.

import type { Opportunity } from "@/lib/gsc/opportunities";
import type { OpportunityReport } from "@/lib/gsc/report";
import { TOPIC_BY_ID, primaryTopic } from "@/lib/intel/lexicon";
import { brandTopics } from "@/lib/intel/serp";
import { contentWords, lines, titleCase } from "@/lib/intel/text";
import type { Project } from "@/lib/types";

type Brief = OpportunityReport["briefs"][number];

export function freeOpportunityReport(project: Project, opportunities: Opportunity[]): OpportunityReport {
  // Cluster by pillar + dominant topic (or the first two meaningful words).
  const clusters = new Map<string, Opportunity[]>();
  for (const o of opportunities) {
    const topic = primaryTopic(o.query);
    const key = `${o.pillar}:${topic ?? contentWords(o.query).slice(0, 2).join(" ")}`;
    clusters.set(key, [...(clusters.get(key) ?? []), o]);
  }
  const facts = brandTopics(project);
  const allFacts = [...lines(project.brand_facts), ...lines(project.usps), ...lines(project.products)];
  const brandWords = new Set(contentWords([project.brand_name, ...(project.brand_aliases ?? []), project.city ?? ""].join(" ")));
  /** Topic match first, then the fact sharing the most distinctive words with the query. */
  const factFor = (query: string, topicId?: string, pillar?: string) => {
    if (topicId && facts.has(topicId)) return facts.get(topicId);
    const qw = contentWords(query).filter((w) => !brandWords.has(w));
    const best = allFacts
      .map((f) => ({ f, n: contentWords(f).filter((w) => qw.includes(w)).length }))
      .sort((a, b) => b.n - a.n)[0];
    if (best && best.n >= 2) return best.f;
    if (pillar === "company" && !qw.length) return allFacts[0];
    return undefined;
  };
  const ranked = [...clusters.entries()]
    .map(([key, qs]) => ({ key, qs: qs.sort((a, b) => b.score - a.score), score: qs.reduce((a, q) => a + q.score, 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const briefs: Brief[] = ranked.map(({ key, qs, score }, i) => {
    const [pillar, rest] = key.split(":") as [Brief["pillar"], string];
    const lead = qs[0];
    const topic = TOPIC_BY_ID[rest];
    const signals = new Set(qs.flatMap((q) => q.signals));
    const action: Brief["action"] = signals.has("low CTR for position")
      ? "title_meta_rewrite"
      : pillar === "competitors"
        ? "comparison_page"
        : rest === "itinerary"
          ? "local_guide"
          : signals.has("question") && !lead.page
            ? "faq_block"
            : lead.page && signals.has("striking distance")
              ? "update_existing"
              : "new_page";
    const fact = factFor(lead.query, topic?.id, pillar);
    return {
      title: titleCase(topic ? `${topic.label}: ${lead.query}` : lead.query),
      action,
      pillar,
      primary_query: lead.query,
      supporting_queries: qs.slice(1, 6).map((q) => q.query),
      target_page: lead.page ?? "new",
      customer_questions: qs.filter((q) => q.signals.includes("question")).slice(0, 4).map((q) => q.query),
      brand_facts_to_use: fact ? [fact] : [`MISSING: ${topic ? `${topic.label.toLowerCase()} details` : `facts that answer “${lead.query}”`}`],
      competitor_angle: pillar === "competitors" ? `Compare honestly on the points where ${project.brand_name} has a documented edge.` : "",
      geo_note:
        pillar === "company"
          ? "State the fact in one plain sentence with the brand name so AI answers can quote it."
          : "Answer the question in the first paragraph; use the searcher's wording in a heading.",
      priority: i < 2 || score > 200 ? "high" : i < 5 ? "medium" : "low",
    };
  });

  const missing = [...new Set(briefs.flatMap((b) => b.brand_facts_to_use.filter((f) => f.startsWith("MISSING")).map((f) => f.replace(/^MISSING:\s*/, ""))))];
  const count = (p: string) => opportunities.filter((o) => o.pillar === p).length;
  return {
    summary: `${opportunities.length} queries analysed: ${count("company")} company, ${count("customers")} customer and ${count("competitors")} competitor queries. The plan groups them into ${briefs.length} briefs ranked by estimated extra clicks. (Free Intelligence mode: rule-based grouping.)`,
    briefs,
    missing_brand_facts: missing,
  };
}
