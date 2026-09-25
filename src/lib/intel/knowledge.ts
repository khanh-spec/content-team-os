// Brand Knowledge Score: how complete the brand's knowledge base is.

import { lines } from "@/lib/intel/text";
import type { Project } from "@/lib/types";

export type KnowledgeItem = { label: string; ok: boolean; weight: number; hint: string };

export function knowledgeScore(p: Project, counts: { documents: number; rules: number; research: number }) {
  const items: KnowledgeItem[] = [
    { label: "Brand summary", ok: !!p.brand_summary?.trim(), weight: 8, hint: "One paragraph on who the brand is." },
    { label: "Approved facts (5+)", ok: lines(p.brand_facts).length >= 5, weight: 16, hint: "Rooms, distances, amenities, awards: one per line." },
    { label: "USPs", ok: lines(p.usps).length >= 2, weight: 8, hint: "What makes the brand the better choice." },
    { label: "Products & services", ok: !!p.products?.trim(), weight: 6, hint: "Rooms, restaurants, spa, events…" },
    { label: "Restricted claims", ok: lines(p.restricted_claims).length >= 1, weight: 8, hint: "Claims the brand must never make." },
    { label: "Tone of voice", ok: !!p.tone_of_voice?.trim(), weight: 8, hint: "How the brand sounds." },
    { label: "Words to avoid / use", ok: !!(p.words_to_avoid?.trim() || p.words_to_use?.trim()), weight: 5, hint: "Vocabulary rules." },
    { label: "CTA preference", ok: !!p.cta_preference?.trim(), weight: 4, hint: "e.g. “Check availability”." },
    { label: "Target audiences", ok: !!p.target_customers?.trim(), weight: 8, hint: "Segments and what they care about." },
    { label: "Competitors listed", ok: (p.competitors ?? []).length >= 2, weight: 7, hint: "At least two, with exact names." },
    { label: "Location set", ok: !!(p.city && p.country_code), weight: 5, hint: "City and country code for local search." },
    { label: "Site pages for internal links", ok: (p.site_pages ?? []).length >= 3, weight: 5, hint: "Rooms, dining, offers, contact…" },
    { label: "Brand documents", ok: counts.documents > 0, weight: 6, hint: "Guidelines, fact sheets, approved articles." },
    { label: "Feedback rules", ok: counts.rules > 0, weight: 3, hint: "Lessons from client feedback." },
    { label: "Market research", ok: counts.research > 0, weight: 3, hint: "At least one Local Research run." },
  ];
  const total = items.reduce((a, i) => a + i.weight, 0);
  const score = Math.round((items.filter((i) => i.ok).reduce((a, i) => a + i.weight, 0) / total) * 100);
  return { score, items, missing: items.filter((i) => !i.ok) };
}
