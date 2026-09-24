import "server-only";

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { MODELS } from "@/lib/env";
import { openai } from "@/lib/openai";
import { googleMaps, googleSearch, localize, normalizeName, sameBusiness, type LocalBusiness } from "@/lib/serpapi";
import type { Project } from "@/lib/types";

// ---------------------------------------------------------------------------
// 1. Plan: fan-out prompts + SerpApi baseline
// ---------------------------------------------------------------------------

const FanoutSchema = z.object({
  prompts: z.array(
    z.object({
      prompt: z.string().describe("A realistic prompt a traveller would type into ChatGPT"),
      angle: z.string().describe("persona / intent angle, e.g. couples, budget, family, luxury, near landmark"),
    }),
  ),
});

export type VisibilityPlan = {
  prompts: { prompt: string; angle: string }[];
  iterations: number;
};

export type SerpBaseline = {
  maps: LocalBusiness[];
  localPack: LocalBusiness[];
  errors: string[];
};

export async function generateFanout(project: Project, seed: string, count: number) {
  const location = [project.city, project.region, project.country].filter(Boolean).join(", ");
  const res = await openai().responses.parse({
    model: MODELS.fast,
    instructions:
      "You generate query fan-outs to measure which local businesses ChatGPT recommends. " +
      "Write prompts exactly the way real travellers phrase them in ChatGPT: natural, specific, " +
      "varied by persona, budget, trip type, location detail and decision stage. " +
      "Never mention the brand or any specific business name in the prompts.",
    input:
      `Seed query: "${seed}"\nDestination: ${location || "unspecified"}\nIndustry: ${project.industry}${project.property_type ? ` / ${project.property_type}` : ""}\n` +
      `Create ${count - 1} fan-out prompts (the seed query itself will be added separately).`,
    text: { format: zodTextFormat(FanoutSchema, "fanout") },
  });
  const prompts = res.output_parsed?.prompts ?? [];
  return [{ prompt: localize(seed, project), angle: "seed" }, ...prompts].slice(0, count);
}

export async function serpBaseline(project: Project, seed: string): Promise<SerpBaseline> {
  const errors: string[] = [];
  const [maps, google] = await Promise.all([
    googleMaps(seed, project).catch((e: Error) => (errors.push(`Maps: ${e.message}`), [] as LocalBusiness[])),
    googleSearch(localize(seed, project), project).catch((e: Error) => (errors.push(`Google local: ${e.message}`), null)),
  ]);
  return { maps, localPack: google?.localPack ?? [], errors };
}

// ---------------------------------------------------------------------------
// 2. One ChatGPT sample (web search forced) + mention extraction
// ---------------------------------------------------------------------------

const MentionSchema = z.object({
  mentions: z.array(
    z.object({
      name: z.string().describe("Business name as written in the answer"),
      canonical: z.string().describe("If this is the brand or a listed competitor, its exact listed name; otherwise the business name"),
      position: z.number().int().describe("1-based order of first appearance among businesses"),
      sentiment: z.enum(["positive", "neutral", "negative"]),
      context: z.string().describe("The short phrase describing the business in the answer"),
    }),
  ),
});

export type Mention = z.infer<typeof MentionSchema>["mentions"][number];
export type Citation = { url: string; title: string; domain: string };

export type Sample = {
  prompt_index: number;
  iteration: number;
  prompt: string;
  answer: string | null;
  mentions: Mention[] | null;
  citations: Citation[] | null;
  error: string | null;
};

function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function runChatGptSample(project: Project, prompt: string) {
  const response = await openai().responses.create({
    model: MODELS.chatgpt,
    input: prompt,
    tools: [
      {
        type: "web_search",
        user_location: {
          type: "approximate",
          city: project.city || undefined,
          region: project.region || undefined,
          country: project.country_code?.toUpperCase() || undefined,
        },
      },
    ],
    tool_choice: "required",
  });

  const answer = response.output_text ?? "";
  const citations = new Map<string, Citation>();
  for (const item of response.output) {
    if (item.type !== "message") continue;
    for (const part of item.content) {
      if (part.type !== "output_text") continue;
      for (const a of part.annotations) {
        if (a.type === "url_citation" && !citations.has(a.url)) {
          citations.set(a.url, { url: a.url, title: a.title, domain: domainOf(a.url) });
        }
      }
    }
  }

  const known = [project.brand_name, ...project.brand_aliases, ...(project.competitors ?? []).map((c) => c.name)];
  const extraction = await openai().responses.parse({
    model: MODELS.fast,
    instructions:
      "Extract every distinct local business (hotel, resort, restaurant, venue, tour operator, etc.) recommended or named in the answer, in order of first appearance. " +
      "Exclude websites/publishers (e.g. Tripadvisor, Booking.com), neighbourhoods and landmarks. " +
      `Known names to canonicalize to (match spelling variants): ${known.join("; ")}.`,
    input: answer.slice(0, 20_000),
    text: { format: zodTextFormat(MentionSchema, "mentions") },
  });

  return {
    answer,
    citations: [...citations.values()],
    mentions: extraction.output_parsed?.mentions ?? [],
  };
}

// ---------------------------------------------------------------------------
// 3. Aggregate: ChatGPT mention share vs Maps / local pack rank
// ---------------------------------------------------------------------------

export type BusinessScore = {
  name: string;
  role: "brand" | "competitor" | "other";
  ai_mentions: number;
  ai_samples: number;
  ai_mention_rate: number; // share of samples mentioning it
  ai_avg_position: number | null;
  ai_prompts: number; // distinct prompts where it appeared
  sentiment: { positive: number; neutral: number; negative: number };
  maps_rank: number | null;
  maps_rating: number | null;
  maps_reviews: number | null;
  local_pack_rank: number | null;
  gap: "both" | "ai_only" | "serp_only" | "neither";
};

export type VisibilitySummary = {
  total_samples: number;
  successful_samples: number;
  avg_mentions_per_answer: number;
  avg_citations_per_answer: number;
  brand: BusinessScore | null;
  brand_share_of_voice: number;
  businesses: BusinessScore[];
  citation_domains: { domain: string; count: number; kind: string }[];
  per_prompt: { prompt: string; angle: string; brand_rate: number; top: string[] }[];
  insights?: VisibilityInsights;
};

function domainKind(domain: string, project: Project) {
  const d = domain.toLowerCase();
  const site = project.website ? domainOf(project.website).toLowerCase() : "";
  if (site && d.endsWith(site)) return "brand site";
  if (/(booking|agoda|expedia|hotels\.com|trip\.com|airbnb|traveloka|vrbo|kayak)/.test(d)) return "OTA";
  if (/(tripadvisor|google|yelp|foursquare)/.test(d)) return "reviews / maps";
  if (/(reddit|quora|forum|lonelyplanet\.com\/thorntree)/.test(d)) return "forum";
  if ((project.competitors ?? []).some((c) => c.website && d.endsWith(domainOf(c.website).toLowerCase()))) return "competitor site";
  return "editorial / other";
}

export function aggregate(
  project: Project,
  plan: VisibilityPlan,
  baseline: SerpBaseline,
  samples: Sample[],
): VisibilitySummary {
  const ok = samples.filter((s) => !s.error && s.mentions);
  const total = ok.length || 1;
  const competitorNames = (project.competitors ?? []).map((c) => c.name);
  const brandNames = [project.brand_name, ...project.brand_aliases];

  const roleOf = (name: string): BusinessScore["role"] =>
    brandNames.some((b) => sameBusiness(b, name)) ? "brand" : competitorNames.some((c) => sameBusiness(c, name)) ? "competitor" : "other";

  const displayName = (name: string) =>
    brandNames.some((b) => sameBusiness(b, name))
      ? project.brand_name
      : (competitorNames.find((c) => sameBusiness(c, name)) ?? name);

  type Acc = { name: string; mentions: number; samples: Set<string>; prompts: Set<number>; positions: number[]; sentiment: BusinessScore["sentiment"] };
  const acc = new Map<string, Acc>();
  const keyFor = (name: string) => {
    const display = displayName(name);
    for (const [k, v] of acc) if (sameBusiness(v.name, display)) return k;
    return normalizeName(display) || display.toLowerCase();
  };

  let mentionTotal = 0;
  let citationTotal = 0;
  const domains = new Map<string, number>();

  for (const s of ok) {
    citationTotal += s.citations?.length ?? 0;
    for (const c of s.citations ?? []) domains.set(c.domain, (domains.get(c.domain) ?? 0) + 1);
    const seenInSample = new Set<string>();
    for (const m of s.mentions ?? []) {
      const name = m.canonical || m.name;
      const key = keyFor(name);
      if (seenInSample.has(key)) continue;
      seenInSample.add(key);
      mentionTotal++;
      const a = acc.get(key) ?? { name: displayName(name), mentions: 0, samples: new Set(), prompts: new Set(), positions: [], sentiment: { positive: 0, neutral: 0, negative: 0 } };
      a.mentions++;
      a.samples.add(`${s.prompt_index}:${s.iteration}`);
      a.prompts.add(s.prompt_index);
      a.positions.push(m.position);
      a.sentiment[m.sentiment]++;
      acc.set(key, a);
    }
  }

  // Make sure SERP-only businesses (top 10) and the brand/competitors appear too.
  const serpNames = [...baseline.maps.slice(0, 10), ...baseline.localPack].map((b) => b.title);
  for (const name of [...brandNames.slice(0, 1), ...competitorNames, ...serpNames]) {
    const key = keyFor(name);
    if (!acc.has(key)) acc.set(key, { name: displayName(name), mentions: 0, samples: new Set(), prompts: new Set(), positions: [], sentiment: { positive: 0, neutral: 0, negative: 0 } });
  }

  const businesses: BusinessScore[] = [...acc.values()].map((a) => {
    const maps = baseline.maps.find((b) => sameBusiness(b.title, a.name));
    const pack = baseline.localPack.find((b) => sameBusiness(b.title, a.name));
    const inAi = a.mentions > 0;
    const inSerp = (!!maps && maps.position <= 10) || !!pack;
    return {
      name: a.name,
      role: roleOf(a.name),
      ai_mentions: a.mentions,
      ai_samples: a.samples.size,
      ai_mention_rate: a.samples.size / total,
      ai_avg_position: a.positions.length ? a.positions.reduce((x, y) => x + y, 0) / a.positions.length : null,
      ai_prompts: a.prompts.size,
      sentiment: a.sentiment,
      maps_rank: maps?.position ?? null,
      maps_rating: maps?.rating ?? null,
      maps_reviews: maps?.reviews ?? null,
      local_pack_rank: pack?.position ?? null,
      gap: inAi && inSerp ? "both" : inAi ? "ai_only" : inSerp ? "serp_only" : "neither",
    };
  });

  businesses.sort(
    (a, b) => b.ai_mention_rate - a.ai_mention_rate || (a.maps_rank ?? 99) - (b.maps_rank ?? 99),
  );

  const brand = businesses.find((b) => b.role === "brand") ?? null;

  const per_prompt = plan.prompts.map((p, i) => {
    const ps = ok.filter((s) => s.prompt_index === i);
    const counts = new Map<string, number>();
    let brandHits = 0;
    for (const s of ps) {
      const names = new Set((s.mentions ?? []).map((m) => displayName(m.canonical || m.name)));
      if ([...names].some((n) => roleOf(n) === "brand")) brandHits++;
      for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    return {
      prompt: p.prompt,
      angle: p.angle,
      brand_rate: ps.length ? brandHits / ps.length : 0,
      top: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => n),
    };
  });

  return {
    total_samples: samples.length,
    successful_samples: ok.length,
    avg_mentions_per_answer: mentionTotal / total,
    avg_citations_per_answer: citationTotal / total,
    brand,
    brand_share_of_voice: brand && mentionTotal ? brand.ai_mentions / mentionTotal : 0,
    businesses,
    citation_domains: [...domains.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([domain, count]) => ({ domain, count, kind: domainKind(domain, project) })),
    per_prompt,
  };
}

// ---------------------------------------------------------------------------
// 4. Recommendations
// ---------------------------------------------------------------------------

const InsightsSchema = z.object({
  headline: z.string(),
  findings: z.array(z.string()),
  recommendations: z.array(
    z.object({
      action: z.string(),
      pillar: z.enum(["company", "customers", "competitors"]),
      priority: z.enum(["high", "medium", "low"]),
      why: z.string(),
    }),
  ),
});
export type VisibilityInsights = z.infer<typeof InsightsSchema>;

export async function visibilityInsights(project: Project, seed: string, summary: VisibilitySummary): Promise<VisibilityInsights | undefined> {
  const compact = {
    seed,
    brand: summary.brand,
    share_of_voice: summary.brand_share_of_voice,
    top_businesses: summary.businesses.slice(0, 15),
    citation_domains: summary.citation_domains.slice(0, 15),
    per_prompt: summary.per_prompt,
  };
  const res = await openai().responses.parse({
    model: MODELS.fast,
    instructions:
      "You are a GEO (generative engine optimisation) strategist for hospitality brands. " +
      "Compare ChatGPT recommendation share with Google Maps / local pack rank. " +
      "Key patterns: 'serp_only' = strong Google Business Profile but missing from AI answers (usually an editorial/citation gap); " +
      "'ai_only' = AI recommends it despite weaker Maps rank (strong editorial/citation footprint). " +
      "Give concrete, brand-specific actions (which cited domains to get listed on, which prompt angles to win, which facts to publish).",
    input: `Brand: ${project.brand_name} (${project.city ?? ""})\nData:\n${JSON.stringify(compact)}`,
    text: { format: zodTextFormat(InsightsSchema, "insights") },
  });
  return res.output_parsed ?? undefined;
}
