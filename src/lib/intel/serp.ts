// Free Intelligence: turn raw SERP / Maps / forum / review data into strategy
// without an LLM. Mirrors the brief's example:
//   intent → top entities → competitor angles → missing opportunities.

import { sameBusiness } from "@/lib/names";
import { extractEntities, type Entity } from "@/lib/intel/entities";
import { classifyIntent } from "@/lib/intel/intent";
import { TOPIC_BY_ID, TOPICS, audienceTopics, topicsIn } from "@/lib/intel/lexicon";
import { collectQuestions, type CustomerQuestion, type QuestionSource } from "@/lib/intel/questions";
import { reviewThemes, type ReviewInput, type ThemeSummary } from "@/lib/intel/reviews";
import { domainOf, fold, lines } from "@/lib/intel/text";
import type { Project } from "@/lib/types";

type Result = { position: number; title: string; link: string; snippet?: string; source?: string };
type Biz = { position: number; title: string; rating?: number; reviews?: number; type?: string; description?: string };
type Post = { title: string; link?: string; snippet?: string; source?: string };

export type SerpInput = {
  query: string;
  organic: Result[];
  questions: { question: string; snippet?: string }[];
  relatedSearches: string[];
  localPack: Biz[];
  maps?: Biz[];
  aiOverview?: string;
  answerBox?: { title?: string; snippet?: string } | null;
  forums?: Post[];
  reddit?: Post[];
  booking?: Post[];
  tripadvisor?: { title: string; rating?: number; reviews?: number }[];
  reviews?: ReviewInput[];
};

export type Angle = { topic: string; label: string; coverage: number; results: number };
export type Gap = { topic: string; label: string; reason: string; format: string; brandCanAnswer: boolean };
export type CompetitorIntel = {
  name: string;
  rating: number | null;
  reviews: number | null;
  mapsRank: number | null;
  localPackRank: number | null;
  strengths: string[];
  weaknesses: string[];
  opportunity: string;
};
export type Recommendation = { title: string; pillar: "company" | "customers" | "competitors"; why: string };

export type SerpInsight = {
  query: string;
  intent: { primary: string; label: string; all: string[] };
  serpFeatures: string[];
  topEntities: Entity[];
  competitorAngles: Angle[];
  missingOpportunities: Gap[];
  customerQuestions: CustomerQuestion[];
  topResults: { position: number; title: string; domain: string; format: string; angles: string[] }[];
  contentFormats: { format: string; count: number }[];
  brandPresence: { organic: number | null; localPack: number | null; maps: number | null };
  reviewThemes: ThemeSummary | null;
  brandReviewThemes: ThemeSummary | null;
  competitors: CompetitorIntel[];
  recommendations: Recommendation[];
};

const OTA = /(booking|agoda|expedia|hotels\.com|trip\.com|airbnb|traveloka|vrbo|kayak|trivago)/;

function formatOf(r: Result, project: Project): string {
  const t = fold(r.title);
  const d = domainOf(r.link);
  if (project.website && d.endsWith(domainOf(project.website))) return "Brand page";
  if ((project.competitors ?? []).some((c) => c.website && d.endsWith(domainOf(c.website)))) return "Competitor page";
  if (OTA.test(d)) return "OTA listing";
  if (/reddit|quora|forum|tripadvisor\.[a-z.]+\/showtopic/.test(d + r.link)) return "Forum thread";
  if (/\b\d+\s+(best|top|things|places|ways|reasons|hotels|restaurants)\b|\btop \d+|\bbest\b.*\b\d+\b/.test(t)) return "Listicle";
  if (/\bvs\.?\b|versus|compar/.test(t)) return "Comparison";
  if (/\bguide\b|\bitinerary\b|\bhow to\b/.test(t)) return "Guide";
  if (/\breview/.test(t) || /tripadvisor/.test(d)) return "Review";
  return "Article / page";
}

/** Topics the brand has approved facts (or USPs/products) about. */
export function brandTopics(project: Project): Map<string, string> {
  const out = new Map<string, string>();
  for (const fact of [...lines(project.brand_facts), ...lines(project.usps), ...lines(project.products)]) {
    for (const t of topicsIn(fact)) if (!out.has(t)) out.set(t, fact);
  }
  return out;
}

export function analyseSerp(project: Project, input: SerpInput): SerpInsight {
  const brandNames = [project.brand_name, ...(project.brand_aliases ?? [])];
  const intent = classifyIntent(input.query, brandNames);
  const organic = input.organic.slice(0, 10);
  const n = organic.length || 1;

  // SERP features
  const serpFeatures = [
    input.answerBox && "Featured snippet",
    input.aiOverview && "AI Overview",
    input.localPack.length && "Local pack",
    input.questions.length && "People Also Ask",
    (input.forums?.length ?? 0) > 0 && "Discussions & forums",
    input.relatedSearches.length && "Related searches",
  ].filter(Boolean) as string[];

  // Entities: landmarks and places the results keep mentioning.
  const place = [project.city, project.region, project.country].filter(Boolean) as string[];
  const businesses = [...input.localPack, ...(input.maps ?? [])].map((b) => b.title);
  const entityDocs = [
    ...organic.map((r) => `${r.title}. ${r.snippet ?? ""}`),
    ...input.questions.map((q) => `${q.question} ${q.snippet ?? ""}`),
    ...(input.forums ?? []).map((f) => `${f.title}. ${f.snippet ?? ""}`),
    input.aiOverview ?? "",
    input.answerBox?.snippet ?? "",
  ].filter(Boolean);
  const topEntities = extractEntities(entityDocs, { exclude: place, excludeBusinesses: brandNames, businesses, limit: 12 });

  // Angles: what the top results talk about.
  const resultTopics = organic.map((r) => topicsIn(`${r.title} ${r.snippet ?? ""}`));
  const coverage = new Map<string, number>();
  for (const ts of resultTopics) for (const t of new Set(ts)) coverage.set(t, (coverage.get(t) ?? 0) + 1);
  const angles: Angle[] = [...coverage.entries()]
    .map(([topic, results]) => ({ topic, label: TOPIC_BY_ID[topic].label, results, coverage: results / n }))
    .sort((a, b) => b.results - a.results);
  const competitorAngles = angles.filter((a) => a.coverage >= 0.2).slice(0, 8);
  const covered = (t: string) => coverage.get(t) ?? 0;

  // Customer questions (PAA weighs more: Google shows it because people ask).
  const qSources: QuestionSource[] = [
    ...input.questions.map((q) => ({ text: q.question, source: "People Also Ask", weight: 2 })),
    ...input.relatedSearches.map((r) => ({ text: r, source: "Related searches" })),
    ...(input.forums ?? []).map((f) => ({ text: f.title, source: /reddit/i.test(f.source ?? f.link ?? "") ? "Reddit" : "Forums" })),
    ...(input.reddit ?? []).map((f) => ({ text: f.title, source: "Reddit" })),
  ];
  const customerQuestions = collectQuestions(qSources, brandNames).slice(0, 15);

  // Demand: topics people ask about (questions, related searches, forums, reviews, the query).
  const demand = new Map<string, Set<string>>();
  const addDemand = (text: string, source: string) => {
    for (const t of topicsIn(text)) demand.set(t, (demand.get(t) ?? new Set()).add(source));
  };
  addDemand(input.query, "your query");
  input.questions.forEach((q) => addDemand(q.question, "People Also Ask"));
  input.relatedSearches.forEach((r) => addDemand(r, "related searches"));
  (input.forums ?? []).forEach((f) => addDemand(`${f.title} ${f.snippet ?? ""}`, "forums"));
  (input.reddit ?? []).forEach((f) => addDemand(`${f.title} ${f.snippet ?? ""}`, "Reddit"));
  (input.reviews ?? []).forEach((r) => addDemand(r.text, "reviews"));

  const factTopics = brandTopics(project);
  const audience = audienceTopics(project.target_customers);
  const accommodation = /\b(hotels?|resorts?|stay|stays|accommodation|villas?|where to stay)\b/.test(fold(input.query)) || /hotel|resort|villa|hospitality/i.test(`${project.industry} ${project.property_type ?? ""}`);
  const gaps = new Map<string, Gap & { priority: number }>();
  const addGap = (topic: string, reason: string, priority: number) => {
    if (covered(topic) / n >= 0.3) return;
    const prev = gaps.get(topic);
    if (prev) {
      prev.priority += priority;
      return;
    }
    const t = TOPIC_BY_ID[topic];
    gaps.set(topic, { topic, label: t.label, reason, format: t.format ?? "New section", brandCanAnswer: factTopics.has(topic), priority: priority + (covered(topic) ? 0 : 1) });
  };
  [...demand.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .forEach(([t, src]) => addGap(t, `Asked in ${[...src].slice(0, 3).join(", ")}, but only ${covered(t)}/${n} top results cover it.`, src.size * 2));
  audience.forEach((t) => addGap(t, `Relevant to your audience (${TOPIC_BY_ID[t].label.toLowerCase()}), but only ${covered(t)}/${n} top results cover it.`, 2));
  if (accommodation) {
    // Hospitality staples that searchers need but listicles rarely cover.
    for (const t of ["family", "itinerary", "transport", "room_comparison"]) {
      if (!covered(t)) addGap(t, `None of the top ${n} results cover it.`, 2);
    }
  }
  const missingOpportunities: Gap[] = [...gaps.values()]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8)
    .map((g) => ({ topic: g.topic, label: g.label, reason: g.reason, format: g.format, brandCanAnswer: g.brandCanAnswer }));

  // Result list with formats
  const topResults = organic.map((r, i) => ({
    position: r.position,
    title: r.title,
    domain: domainOf(r.link),
    format: formatOf(r, project),
    angles: resultTopics[i].map((t) => TOPIC_BY_ID[t].label).slice(0, 4),
  }));
  const formatCounts = new Map<string, number>();
  topResults.forEach((r) => formatCounts.set(r.format, (formatCounts.get(r.format) ?? 0) + 1));
  const contentFormats = [...formatCounts.entries()].map(([format, count]) => ({ format, count })).sort((a, b) => b.count - a.count);

  // Brand presence
  const site = project.website ? domainOf(project.website) : null;
  const brandHit = (b: Biz) => brandNames.some((name) => sameBusiness(name, b.title));
  const brandPresence = {
    organic: site ? (organic.find((r) => domainOf(r.link).endsWith(site))?.position ?? null) : null,
    localPack: input.localPack.find(brandHit)?.position ?? null,
    maps: input.maps?.find(brandHit)?.position ?? null,
  };

  // Reviews
  const reviews = input.reviews ?? [];
  const allThemes = reviews.length ? reviewThemes(reviews) : null;
  const brandReviews = reviews.filter((r) => brandNames.some((b) => sameBusiness(b, r.place)));
  const brandReviewThemes = brandReviews.length ? reviewThemes(brandReviews) : null;

  // Competitors: listed competitors + top local results that aren't the brand.
  const local = [...input.localPack, ...(input.maps ?? [])];
  const names: string[] = [];
  for (const c of project.competitors ?? []) names.push(c.name);
  for (const b of local.slice(0, 8)) if (!brandHit(b) && !names.some((n2) => sameBusiness(n2, b.title))) names.push(b.title);
  const competitors: CompetitorIntel[] = names.slice(0, 6).map((name) => {
    const maps = input.maps?.find((b) => sameBusiness(b.title, name));
    const pack = input.localPack.find((b) => sameBusiness(b.title, name));
    const ta = input.tripadvisor?.find((p) => sameBusiness(p.title, name));
    const themes = reviewThemes(reviews.filter((r) => sameBusiness(r.place, name)), 4);
    const weaknessTopics = themes.negative.map((t) => t.topic);
    const edge = weaknessTopics.find((t) => factTopics.has(t) || brandReviewThemes?.positive.some((p) => p.topic === t));
    const opportunity = edge
      ? factTopics.has(edge)
        ? `Explain ${project.brand_name}'s advantage on ${TOPIC_BY_ID[edge].label.toLowerCase()}: “${factTopics.get(edge)}”.`
        : `Guests praise ${project.brand_name}'s ${TOPIC_BY_ID[edge].label.toLowerCase()}; highlight it where ${name} is weaker.`
      : "";
    return {
      name,
      rating: maps?.rating ?? pack?.rating ?? ta?.rating ?? null,
      reviews: maps?.reviews ?? pack?.reviews ?? ta?.reviews ?? null,
      mapsRank: maps?.position ?? null,
      localPackRank: pack?.position ?? null,
      strengths: themes.positive.map((t) => t.label),
      weaknesses: themes.negative.map((t) => t.label),
      opportunity,
    };
  });

  // Recommendations (templated)
  const recommendations: Recommendation[] = [];
  for (const g of missingOpportunities.slice(0, 3)) {
    recommendations.push({
      title: `${g.format}: cover ${g.label.toLowerCase()} for “${input.query}”`,
      pillar: "customers",
      why: g.reason + (g.brandCanAnswer ? " Your approved facts already support it." : " Add supporting facts to the brand profile first."),
    });
  }
  if (customerQuestions.length >= 4) {
    recommendations.push({ title: `Add an FAQ block answering the top ${Math.min(6, customerQuestions.length)} customer questions`, pillar: "customers", why: "Direct, self-contained answers are what People Also Ask and AI answers quote." });
  }
  if (brandPresence.organic == null && brandPresence.localPack == null) {
    recommendations.push({
      title: `Make ${project.brand_name} explicit for this search: brand + ${project.city ?? "location"} + approved facts in the first 100 words`,
      pillar: "company",
      why: "The brand doesn't appear in the organic top 10 or the local pack for this query.",
    });
  }
  if (input.localPack.length && brandPresence.localPack == null) {
    recommendations.push({ title: "Strengthen the Google Business Profile (categories, photos, review replies)", pillar: "company", why: "A local pack shows for this query and the brand isn't in it." });
  }
  const withEdge = competitors.find((c) => c.opportunity);
  if (withEdge) recommendations.push({ title: `Position against ${withEdge.name}`, pillar: "competitors", why: withEdge.opportunity });

  return {
    query: input.query,
    intent,
    serpFeatures,
    topEntities,
    competitorAngles,
    missingOpportunities,
    customerQuestions,
    topResults,
    contentFormats,
    brandPresence,
    reviewThemes: allThemes,
    brandReviewThemes,
    competitors,
    recommendations,
  };
}

export const ALL_TOPICS = TOPICS.map((t) => ({ id: t.id, label: t.label }));
