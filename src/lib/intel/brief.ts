// Content Brief Generator (free mode): SERP insight + brand profile → brief.

import { TOPIC_BY_ID, topicsIn } from "@/lib/intel/lexicon";
import { brandTopics, type SerpInsight } from "@/lib/intel/serp";
import { contentWords, fold, lines, titleCase } from "@/lib/intel/text";
import type { Project } from "@/lib/types";

export type ContentBrief = {
  topic: string;
  brand: string;
  mode: "free" | "ai";
  searchIntent: string;
  audience: string[];
  customerQuestions: { question: string; sources: string[]; frequency: string }[];
  requiredEntities: { name: string; type: string }[];
  competitorAngles: { label: string; coverage: number }[];
  gaps: { label: string; reason: string; format: string }[];
  brandIntegration: { point: string; detail: string }[];
  internalLinks: { title: string; url: string; reason: string }[];
  outline: { heading: string; notes: string[] }[];
  titleIdeas: string[];
  metaDescription: string;
  geoChecklist: string[];
  wordCount: { min: number; max: number };
  topResults: SerpInsight["topResults"];
  aiNotes?: string;
};

const AUDIENCE_LABEL: Record<string, string> = { family: "Families", couples: "Couples", business: "Business travellers" };

export function buildBrief(project: Project, topic: string, serp: SerpInsight): ContentBrief {
  const city = project.city ?? "";
  const brand = project.brand_name;
  const queryTopics = new Set([...topicsIn(topic), ...serp.customerQuestions.slice(0, 8).flatMap((q) => q.topics)]);

  // Audience: profile segments that match what this topic is about.
  const segments = (project.target_customers ?? "").split(/\n|;|,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean);
  let audience = segments.filter((s) => topicsIn(s).some((t) => queryTopics.has(t)));
  for (const t of ["family", "couples", "business"]) {
    if (queryTopics.has(t) && !audience.some((a) => topicsIn(a).includes(t))) audience.push(AUDIENCE_LABEL[t]);
  }
  if (!audience.length) audience = segments.slice(0, 2);
  audience = audience.map((a) => (a.length > 80 ? `${a.slice(0, 77)}…` : a)).slice(0, 4);

  // Brand integration: approved facts that prove the angles people care about.
  const relevant = new Set([...queryTopics, ...serp.competitorAngles.map((a) => a.topic), ...serp.missingOpportunities.map((g) => g.topic), "location"]);
  const facts = [...lines(project.brand_facts), ...lines(project.usps), ...lines(project.products)];
  const scored = facts
    .map((f) => ({ f, topics: topicsIn(f), score: topicsIn(f).filter((t) => relevant.has(t)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const brandIntegration = scored.slice(0, 6).map((x) => ({
    point: x.topics.filter((t) => relevant.has(t)).map((t) => TOPIC_BY_ID[t].label).join(" · ") || "Brand fact",
    detail: x.f,
  }));
  const factTopics = brandTopics(project);
  for (const g of serp.missingOpportunities) {
    if (!factTopics.has(g.topic)) brandIntegration.push({ point: g.label, detail: `MISSING: add verified ${g.label.toLowerCase()} details to the brand profile before writing this section.` });
  }

  // Internal links from the project's site pages.
  const signal = new Set([...contentWords(topic), ...serp.competitorAngles.flatMap((a) => contentWords(a.label)), ...serp.topEntities.slice(0, 6).flatMap((e) => contentWords(e.name))]);
  const internalLinks = (project.site_pages ?? [])
    .map((p) => {
      const pw = contentWords(`${p.title} ${p.type ?? ""}`);
      const hit = pw.filter((w) => signal.has(w));
      const tHit = topicsIn(`${p.title} ${p.type ?? ""}`).filter((t) => relevant.has(t));
      return { p, score: hit.length + tHit.length * 2, why: tHit.length ? TOPIC_BY_ID[tHit[0]].label : hit[0] };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => ({ title: x.p.title, url: x.p.url, reason: `Supports the ${String(x.why).toLowerCase()} angle` }));

  // Outline
  const factFor = (t: string) => factTopics.get(t);
  const outline: ContentBrief["outline"] = [
    {
      heading: "Quick answer",
      notes: [`Answer “${topic}” in 2–3 sentences that name ${brand}${city ? `, ${city}` : ""} and one approved fact.`, "Keep it self-contained so AI answers can quote it."],
    },
  ];
  for (const a of serp.competitorAngles.slice(0, 4)) {
    const f = factFor(a.topic);
    outline.push({
      heading: a.label,
      notes: [`${Math.round(a.coverage * 100)}% of top results cover this: match it.`, f ? `Proof point: ${f}` : `No approved ${a.label.toLowerCase()} fact yet. Keep it factual or ask the client.`],
    });
  }
  for (const g of serp.missingOpportunities.slice(0, 2)) {
    outline.push({ heading: g.label, notes: [`Gap: ${g.reason}`, factFor(g.topic) ? `Proof point: ${factFor(g.topic)}` : "Needs client input."] });
  }
  const landmarks = serp.topEntities.filter((e) => e.type === "Landmark" || e.type === "Place").slice(0, 6).map((e) => e.name);
  if (landmarks.length) outline.push({ heading: `Nearby: ${landmarks.slice(0, 3).join(", ")}`, notes: [`Mention: ${landmarks.join(", ")}.`, factFor("location") ? `Anchor distances to ${brand}: ${factFor("location")}` : "Give walking or driving times from the property."] });
  if (/Commercial|Transactional|Local/.test(serp.intent.label)) {
    outline.push({ heading: `Why stay at ${brand}`, notes: facts.slice(0, 3).map((f) => `✓ ${f}`).concat(facts.length ? [] : ["Add USPs to the brand profile."]) });
  }
  if (serp.customerQuestions.length) outline.push({ heading: "FAQs", notes: serp.customerQuestions.slice(0, 5).map((q) => q.question) });
  outline.push({ heading: "Call to action", notes: [project.cta_preference ? `Use the preferred CTA: ${project.cta_preference}` : "End with one clear next step (check availability / plan your stay)."] });

  const listy = serp.contentFormats.some((f) => ["Listicle", "Guide"].includes(f.format) && f.count >= 3);
  const wordCount = serp.intent.primary === "Transactional" ? { min: 400, max: 800 } : listy ? { min: 1200, max: 1800 } : { min: 800, max: 1200 };

  const T = titleCase(topic.replace(/\s+/g, " ").trim());
  const year = new Date().getFullYear();
  const cityIn = city && !fold(topic).includes(fold(city)) ? ` in ${city}` : "";
  const titleIdeas = [`${T}${cityIn} (${year}): A Local's Guide`, `${T}: Insider Tips from ${brand}`, `${T}${cityIn}: Where to Go, Stay and Eat`];
  const lead = facts[0] ? ` ${facts[0]}.` : "";
  const metaDescription = `${T}${cityIn}: practical tips, nearby highlights and where to stay.${lead}`.slice(0, 158);

  const geoChecklist = [
    `Where should I stay for “${topic}”? → names ${brand} with a location fact`,
    `Why choose ${brand}? → at least two approved facts, stated plainly`,
    ...(audience[0] ? [`Best option for ${audience[0].toLowerCase()}? → a sentence that pairs ${brand} with that audience`] : []),
    ...serp.customerQuestions.slice(0, 2).map((q) => `${q.question} → answered in one self-contained paragraph`),
  ];

  return {
    topic,
    brand,
    mode: "free",
    searchIntent: serp.intent.label,
    audience,
    customerQuestions: serp.customerQuestions.slice(0, 10).map((q) => ({ question: q.question, sources: q.sources, frequency: q.frequency })),
    requiredEntities: serp.topEntities.slice(0, 10).map((e) => ({ name: e.name, type: e.type })),
    competitorAngles: serp.competitorAngles.map((a) => ({ label: a.label, coverage: a.coverage })),
    gaps: serp.missingOpportunities.map((g) => ({ label: g.label, reason: g.reason, format: g.format })),
    brandIntegration: brandIntegration.slice(0, 8),
    internalLinks,
    outline,
    titleIdeas,
    metaDescription,
    geoChecklist,
    wordCount,
    topResults: serp.topResults,
  };
}
