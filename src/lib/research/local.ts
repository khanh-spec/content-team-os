import "server-only";

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { MODELS } from "@/lib/env";
import { openai } from "@/lib/openai";
import { brandProfile } from "@/lib/context";
import {
  googleForums,
  googleMaps,
  googleMapsReviews,
  googleSearch,
  localize,
  sameBusiness,
  siteSearch,
  tripadvisorReviews,
  tripadvisorSearch,
  type ForumPost,
  type LocalBusiness,
  type OrganicResult,
  type Question,
  type Review,
  type TripadvisorPlace,
} from "@/lib/serpapi";
import type { Project } from "@/lib/types";

export const LOCAL_SOURCES = [
  { id: "google", label: "Google SERP + People Also Ask + AI Overview" },
  { id: "maps", label: "Google Maps (local results)" },
  { id: "google_reviews", label: "Google reviews (brand + top competitors)" },
  { id: "forums", label: "Google Forums (Reddit, Quora, travel forums)" },
  { id: "reddit", label: "Reddit" },
  { id: "tripadvisor", label: "Tripadvisor places + reviews" },
  { id: "booking", label: "Booking.com (search snippets)" },
] as const;

export type LocalSourceId = (typeof LOCAL_SOURCES)[number]["id"];

export type LocalSources = {
  query: string;
  organic: OrganicResult[];
  questions: Question[];
  relatedSearches: string[];
  aiOverview?: string;
  localPack: LocalBusiness[];
  maps: LocalBusiness[];
  forums: ForumPost[];
  reddit: ForumPost[];
  booking: ForumPost[];
  tripadvisor: TripadvisorPlace[];
  reviews: Review[];
  errors: { source: string; message: string }[];
  serpapiCalls: number;
};

export const LocalSummarySchema = z.object({
  overview: z.string().describe("3-5 sentence summary of what the market/customers care about for this topic"),
  customer_questions: z
    .array(
      z.object({
        question: z.string(),
        source: z.string().describe("PAA, Reddit, Tripadvisor, Google reviews, Booking, Forums, Related searches"),
        intent: z.enum(["informational", "planning", "comparison", "transactional", "local"]),
        brand_can_answer: z.enum(["yes", "partially", "no", "unknown"]),
      }),
    )
    .describe("Real questions customers ask, deduplicated, most frequent/valuable first (10-25)"),
  themes: z.array(
    z.object({
      theme: z.string(),
      sentiment: z.enum(["positive", "negative", "mixed", "neutral"]),
      evidence: z.array(z.string()).describe("short quotes or paraphrases from reviews/forums"),
      sources: z.array(z.string()),
    }),
  ),
  customer_vocabulary: z.array(z.string()).describe("Natural phrases real guests use that content should mirror"),
  local_facts: z
    .array(z.object({ fact: z.string(), source: z.string(), confidence: z.enum(["high", "medium", "low"]) }))
    .describe("Concrete, checkable local facts about the area (distances, landmarks, seasons, prices) found in sources"),
  brand_perception: z.object({
    summary: z.string(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    found_in_sources: z.boolean(),
  }),
  competitor_insights: z.array(
    z.object({
      name: z.string(),
      visibility: z.string().describe("Where it appears: Maps rank, local pack, Tripadvisor, forums..."),
      positioning: z.string(),
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
    }),
  ),
  content_angles: z.array(
    z.object({
      title: z.string(),
      target_query: z.string(),
      pillar: z.enum(["company", "customers", "competitors"]),
      why: z.string(),
    }),
  ),
});

export type LocalSummary = z.infer<typeof LocalSummarySchema>;

async function attempt<T>(errors: LocalSources["errors"], source: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    errors.push({ source, message: e instanceof Error ? e.message : String(e) });
    return fallback;
  }
}

export async function collectLocalSources(
  project: Project,
  topic: string,
  enabled: LocalSourceId[],
): Promise<LocalSources> {
  const on = (id: LocalSourceId) => enabled.includes(id);
  const errors: LocalSources["errors"] = [];
  let calls = 0;
  const q = localize(topic, project);
  const competitors = (project.competitors ?? []).slice(0, 2);

  const count = <T>(p: Promise<T>) => {
    calls++;
    return p;
  };

  const [google, forums, reddit, booking, maps, taPlaces] = await Promise.all([
    on("google") ? attempt(errors, "google", () => count(googleSearch(q, project)), null) : null,
    on("forums") ? attempt(errors, "forums", () => count(googleForums(q, project)), []) : [],
    on("reddit") ? attempt(errors, "reddit", () => count(siteSearch(q, "reddit.com", project)), []) : [],
    on("booking")
      ? attempt(errors, "booking", () => count(siteSearch(`${project.brand_name} ${project.city ?? ""} reviews`, "booking.com", project)), [])
      : [],
    on("maps") || on("google_reviews") ? attempt(errors, "maps", () => count(googleMaps(topic, project)), []) : [],
    on("tripadvisor") ? attempt(errors, "tripadvisor", () => count(tripadvisorSearch(q)), []) : [],
  ]);

  // Reviews: brand first, then up to two named competitors.
  const reviewJobs: Promise<Review[]>[] = [];
  const targets = [project.brand_name, ...competitors.map((c) => c.name)];

  if (on("google_reviews")) {
    for (const name of targets) {
      reviewJobs.push(
        attempt(errors, `google_reviews:${name}`, async () => {
          let hit = maps.find((b) => sameBusiness(b.title, name));
          if (!hit) {
            const lookup = await count(googleMaps(localize(name, project), project));
            hit = lookup.find((b) => sameBusiness(b.title, name)) ?? lookup[0];
          }
          if (!hit?.data_id) return [];
          return count(googleMapsReviews(hit.data_id, hit.title, project));
        }, []),
      );
    }
  }
  if (on("tripadvisor")) {
    for (const name of targets) {
      reviewJobs.push(
        attempt(errors, `tripadvisor_reviews:${name}`, async () => {
          let hit = taPlaces.find((p) => sameBusiness(p.title, name));
          if (!hit) {
            const lookup = await count(tripadvisorSearch(localize(name, project)));
            hit = lookup.find((p) => sameBusiness(p.title, name));
          }
          if (!hit?.place_id) return [];
          return count(tripadvisorReviews(hit.place_id, hit.title));
        }, []),
      );
    }
  }
  const reviews = (await Promise.all(reviewJobs)).flat();

  return {
    query: q,
    organic: google?.organic ?? [],
    questions: google?.questions ?? [],
    relatedSearches: google?.relatedSearches ?? [],
    aiOverview: google?.aiOverview,
    localPack: google?.localPack ?? [],
    maps,
    forums: [...forums, ...(google?.discussions ?? [])],
    reddit,
    booking,
    tripadvisor: taPlaces,
    reviews,
    errors,
    serpapiCalls: calls,
  };
}

function sourcesDigest(s: LocalSources): string {
  const lines: string[] = [];
  const add = (title: string, items: string[]) => {
    if (items.length) lines.push(`### ${title}\n${items.join("\n")}`);
  };
  add("People Also Ask", s.questions.map((q) => `- ${q.question}${q.snippet ? ` — ${q.snippet}` : ""}`));
  add("Related searches", s.relatedSearches.map((r) => `- ${r}`));
  if (s.aiOverview) add("Google AI Overview", [s.aiOverview]);
  add("Top organic results", s.organic.map((r) => `${r.position}. ${r.title} (${r.source ?? r.link}) — ${r.snippet ?? ""}`));
  add("Google local pack", s.localPack.map((b) => `${b.position}. ${b.title} — ${b.rating ?? "?"}★ (${b.reviews ?? 0}) ${b.type ?? ""}`));
  add("Google Maps results", s.maps.slice(0, 15).map((b) => `${b.position}. ${b.title} — ${b.rating ?? "?"}★ (${b.reviews ?? 0}) ${b.type ?? ""} ${b.description ?? ""}`));
  add("Tripadvisor", s.tripadvisor.map((p) => `- ${p.title} — ${p.rating ?? "?"}★ (${p.reviews ?? 0} reviews) ${p.type ?? ""}`));
  add("Forum threads", s.forums.map((f) => `- [${f.source ?? "forum"}] ${f.title} — ${f.snippet ?? ""}`));
  add("Reddit", s.reddit.map((f) => `- ${f.title} — ${f.snippet ?? ""}`));
  add("Booking.com snippets", s.booking.map((f) => `- ${f.title} — ${f.snippet ?? ""}`));
  add("Reviews", s.reviews.map((r) => `- [${r.source} · ${r.place} · ${r.rating ?? "?"}★ · ${r.date ?? ""}] ${r.text.slice(0, 500)}`));
  return lines.join("\n\n").slice(0, 60_000);
}

export async function synthesizeLocal(project: Project, topic: string, sources: LocalSources): Promise<LocalSummary> {
  const response = await openai().responses.parse({
    model: MODELS.writer,
    instructions:
      "You are a local-market research analyst for a hospitality SEO/GEO agency. " +
      "Work only from the supplied source data; never invent reviews, facts or rankings. " +
      "Organize findings around the 3C framework (Company, Customers, Competitors). " +
      "Be specific to the destination, cite the source type for each item, and keep quotes short.",
    input: `# Brand profile\n${brandProfile(project)}\n\n# Research topic\n${topic}\n\n# Collected source data\n${sourcesDigest(sources)}`,
    text: { format: zodTextFormat(LocalSummarySchema, "local_context") },
  });
  if (!response.output_parsed) throw new Error("The model did not return a research summary");
  return response.output_parsed;
}
