import "server-only";

import { requireEnv } from "@/lib/env";
import type { Project } from "@/lib/types";

type Params = Record<string, string | number | boolean | undefined | null>;

export async function serp<T = Record<string, unknown>>(params: Params): Promise<T> {
  const url = new URL("https://serpapi.com/search.json");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  url.searchParams.set("api_key", requireEnv("SERPAPI_API_KEY"));
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok || json.error) {
    // "hasn't returned any results" is not a failure for our purposes.
    if (json.error && /hasn't returned any results/i.test(json.error)) return json;
    throw new Error(`SerpApi ${params.engine}: ${json.error ?? res.statusText}`);
  }
  return json;
}

/** Location helpers derived from the project profile. */
export function geo(project: Project) {
  const place = [project.city, project.region, project.country].filter(Boolean).join(", ");
  return {
    place,
    location: project.serp_location || place || undefined,
    gl: project.country_code?.toLowerCase() || undefined,
    hl: project.language || "en",
    ll:
      project.latitude != null && project.longitude != null
        ? `@${project.latitude},${project.longitude},14z`
        : undefined,
  };
}

/** Append the city when the query doesn't already mention it. */
export function localize(query: string, project: Project) {
  const city = project.city?.trim();
  if (!city || query.toLowerCase().includes(city.toLowerCase())) return query;
  return `${query} ${city}`;
}

// ---------------------------------------------------------------------------
// Normalized result shapes
// ---------------------------------------------------------------------------

export type LocalBusiness = {
  position: number;
  title: string;
  rating?: number;
  reviews?: number;
  type?: string;
  address?: string;
  website?: string;
  price?: string;
  description?: string;
  data_id?: string;
  place_id?: string;
};

export type OrganicResult = { position: number; title: string; link: string; snippet?: string; source?: string };
export type Question = { question: string; snippet?: string; link?: string };
export type ForumPost = { title: string; link: string; snippet?: string; source?: string; date?: string };
export type Review = { source: string; place: string; rating?: number; date?: string; text: string };

type Raw = Record<string, unknown>;
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) => (typeof v === "number" ? v : undefined);

function toBusiness(r: Raw, i: number): LocalBusiness {
  return {
    position: num(r.position) ?? i + 1,
    title: str(r.title) ?? "",
    rating: num(r.rating),
    reviews: num(r.reviews),
    type: str(r.type),
    address: str(r.address),
    website: str(r.website) ?? str((r.links as Raw | undefined)?.website),
    price: str(r.price),
    description: str(r.description),
    data_id: str(r.data_id),
    place_id: str(r.place_id),
  };
}

// ---------------------------------------------------------------------------
// Engines
// ---------------------------------------------------------------------------

export async function googleSearch(q: string, project: Project) {
  const g = geo(project);
  const json = await serp<Raw>({ engine: "google", q, location: g.location, gl: g.gl, hl: g.hl, num: 10 });
  const local = json.local_results as Raw | Raw[] | undefined;
  const localPlaces = Array.isArray(local) ? local : arr(local?.places);
  return {
    organic: arr(json.organic_results).slice(0, 10).map(
      (r, i): OrganicResult => ({
        position: num(r.position) ?? i + 1,
        title: str(r.title) ?? "",
        link: str(r.link) ?? "",
        snippet: str(r.snippet),
        source: str(r.source),
      }),
    ),
    questions: arr(json.related_questions).map(
      (r): Question => ({ question: str(r.question) ?? "", snippet: str(r.snippet), link: str(r.link) }),
    ),
    localPack: localPlaces.map(toBusiness),
    relatedSearches: arr(json.related_searches)
      .map((r) => str(r.query))
      .filter((s): s is string => !!s),
    discussions: arr(json.discussions_and_forums).map(
      (r): ForumPost => ({ title: str(r.title) ?? "", link: str(r.link) ?? "", snippet: str(r.snippet), source: str(r.source), date: str(r.date) }),
    ),
    aiOverview: extractAiOverview(json.ai_overview),
    answerBox: json.answer_box
      ? { title: str((json.answer_box as Raw).title), snippet: str((json.answer_box as Raw).snippet) ?? str((json.answer_box as Raw).answer) }
      : null,
  };
}

function extractAiOverview(v: unknown): string | undefined {
  const blocks = arr((v as Raw | undefined)?.text_blocks);
  if (!blocks.length) return undefined;
  const lines: string[] = [];
  for (const b of blocks) {
    if (str(b.snippet)) lines.push(str(b.snippet)!);
    for (const li of arr(b.list)) if (str(li.snippet)) lines.push(`- ${str(li.snippet)}`);
  }
  return lines.join("\n").slice(0, 4000) || undefined;
}

export async function googleForums(q: string, project: Project): Promise<ForumPost[]> {
  const g = geo(project);
  const json = await serp<Raw>({ engine: "google_forums", q, location: g.location, gl: g.gl, hl: g.hl });
  return arr(json.organic_results).slice(0, 12).map((r) => {
    // "About this result" often carries a top comment, e.g. "I highly recommend X…"
    const comment = str(((r.about_this_result as Raw | undefined)?.source as Raw | undefined)?.description);
    return {
      title: str(r.title) ?? "",
      link: str(r.link) ?? "",
      snippet: [str(r.snippet), comment && `Top comment: ${comment}`].filter(Boolean).join(" | ") || undefined,
      source: str(r.source),
      date: str(r.displayed_meta) ?? str(r.date),
    };
  });
}

/** Organic results restricted to one site, e.g. reddit.com or booking.com. */
export async function siteSearch(q: string, site: string, project: Project): Promise<ForumPost[]> {
  const g = geo(project);
  const json = await serp<Raw>({ engine: "google", q: `${q} site:${site}`, gl: g.gl, hl: g.hl, num: 10 });
  return arr(json.organic_results).slice(0, 10).map((r) => ({
    title: str(r.title) ?? "",
    link: str(r.link) ?? "",
    snippet: str(r.snippet),
    source: site,
    date: str(r.date),
  }));
}

export async function googleMaps(q: string, project: Project): Promise<LocalBusiness[]> {
  const g = geo(project);
  const json = await serp<Raw>({
    engine: "google_maps",
    type: "search",
    q: g.ll ? q : localize(q, project),
    ll: g.ll,
    hl: g.hl,
  });
  return arr(json.local_results).slice(0, 20).map(toBusiness);
}

export async function googleMapsReviews(dataId: string, place: string, project: Project, sortBy = "qualityScore"): Promise<Review[]> {
  const json = await serp<Raw>({ engine: "google_maps_reviews", data_id: dataId, hl: geo(project).hl, sort_by: sortBy });
  return arr(json.reviews).slice(0, 10).map((r) => ({
    source: "Google",
    place,
    rating: num(r.rating),
    date: str(r.date),
    text: str(r.snippet) ?? str((r.extracted_snippet as Raw | undefined)?.original) ?? "",
  })).filter((r) => r.text);
}

export type TripadvisorPlace = { title: string; place_id: string; rating?: number; reviews?: number; link?: string; location?: string; type?: string };

export async function tripadvisorSearch(q: string, ssrc = "a"): Promise<TripadvisorPlace[]> {
  const json = await serp<Raw>({ engine: "tripadvisor", q, ssrc, limit: 30 });
  return arr(json.places).slice(0, 15).map((r) => ({
    title: str(r.title) ?? "",
    place_id: String(r.place_id ?? ""),
    rating: num(r.rating),
    reviews: num(r.reviews),
    link: str(r.link),
    location: str(r.location),
    type: str(r.place_type),
  }));
}

export async function tripadvisorReviews(placeId: string, place: string): Promise<Review[]> {
  const json = await serp<Raw>({ engine: "tripadvisor_reviews", place_id: placeId, limit: 15 });
  return arr(json.reviews).slice(0, 15).map((r) => ({
    source: "Tripadvisor",
    place,
    rating: num(r.rating),
    date: str(r.date),
    text: [str(r.title), str(r.snippet)].filter(Boolean).join(" — "),
  })).filter((r) => r.text);
}

export { normalizeName, sameBusiness } from "@/lib/names";
