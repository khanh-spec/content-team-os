// Rule-based search intent classification.

import { fold } from "@/lib/intel/text";

export type Intent = "Informational" | "Commercial investigation" | "Transactional" | "Navigational" | "Local";

const RULES: { intent: Intent; re: RegExp }[] = [
  { intent: "Transactional", re: /\b(book|booking|deals?|discount|promo|coupon|reserve|reservation|rates?|price|prices|cheap|cheapest|packages?|offer)\b/ },
  { intent: "Commercial investigation", re: /\b(best|top|vs|versus|reviews?|compare|comparison|alternatives?|recommended|which|luxury|boutique|rated)\b/ },
  { intent: "Local", re: /\b(near|nearby|near me|close to|around|walking distance|in the area)\b/ },
  { intent: "Informational", re: /(^|\b)(how|what|why|when|where|is|are|can|does|do|guide|things to do|tips|ideas|itinerary|history|weather|meaning)\b|\?$/ },
];

export function classifyIntent(query: string, brandNames: string[] = []): { primary: Intent; all: Intent[]; label: string } {
  const q = fold(query);
  const all: Intent[] = [];
  if (brandNames.some((b) => b && q.includes(fold(b)))) all.push("Navigational");
  for (const r of RULES) if (r.re.test(q) && !all.includes(r.intent)) all.push(r.intent);
  if (!all.length) all.push(/\b(hotels?|resorts?|restaurants?|villas?|stays?)\b/.test(q) ? "Commercial investigation" : "Informational");
  // "best hotels" is investigation, not a booking query.
  const primary = all.includes("Commercial investigation") && all.includes("Transactional") && !/\b(book|deal|promo|coupon|reserve)\b/.test(q) ? "Commercial investigation" : all[0];
  const ordered = [primary, ...all.filter((i) => i !== primary)];
  const short = (i: Intent) => (i === "Commercial investigation" && ordered.length > 1 ? "Commercial" : i);
  return { primary, all: ordered, label: ordered.length > 1 ? ordered.slice(0, 2).map(short).join(" + ") : primary };
}
