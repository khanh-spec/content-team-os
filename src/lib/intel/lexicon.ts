// Hospitality topic lexicon: the "angles" content and reviews talk about.
// Each topic has regex patterns matched against folded (lowercase, no accents) text.

import { fold } from "@/lib/intel/text";

export type Topic = {
  id: string;
  label: string;
  patterns: RegExp[];
  /** Format that best covers the topic when it's a gap. */
  format?: string;
};

export const TOPICS: Topic[] = [
  { id: "location", label: "Location", patterns: [/\blocation\b/, /\bcentral\b/, /\bwalk(ing)? (distance|to)\b/, /\b\d+ ?(min|mins|minutes?) (walk|drive|from)\b/, /\bclose to\b/, /\bheart of\b/, /\bdowntown\b/, /\bcbd\b/] },
  { id: "breakfast", label: "Breakfast", patterns: [/\bbreakfast\b/, /\bbrunch\b/] },
  { id: "dining", label: "Dining", patterns: [/\brestaurants?\b/, /\bdining\b/, /\bcuisine\b/, /\bfood\b/, /\bbar\b/, /\bcafe\b/, /\bmenu\b/, /\bdinner\b/] },
  { id: "rooms", label: "Rooms", patterns: [/\brooms?\b/, /\bsuites?\b/, /\bbeds?\b/, /\bbalcon(y|ies)\b/, /\bvillas?\b/, /\bapartments?\b/] },
  { id: "room_comparison", label: "Room comparison", patterns: [/\broom types?\b/, /\bwhich room\b/, /\b(compare|comparison|vs\.?|versus)\b.*\broom/, /\broom.*\b(compare|comparison|vs\.?|versus)\b/, /\bsuite vs\b/], format: "Room comparison page" },
  { id: "pool", label: "Pool", patterns: [/\bpools?\b/, /\bswimming\b/, /\binfinity\b/] },
  { id: "spa", label: "Spa & wellness", patterns: [/\bspa\b/, /\bmassage\b/, /\bwellness\b/, /\bsauna\b/] },
  { id: "family", label: "Family travel", patterns: [/\bfamil(y|ies)\b/, /\bkids?\b/, /\bchildren\b/, /\bchild\b/, /\btoddlers?\b/, /\bbab(y|ies)\b/], format: "Family guide" },
  { id: "couples", label: "Couples & romance", patterns: [/\bcouples?\b/, /\bromantic\b/, /\bhoneymoon\b/, /\banniversary\b/] },
  { id: "business", label: "Business travel", patterns: [/\bbusiness\b/, /\bmeetings?\b/, /\bconference\b/, /\bcoworking\b/, /\bwork trip\b/] },
  { id: "parking", label: "Parking", patterns: [/\bparking\b/, /\bcar ?park\b/, /\bvalet\b/] },
  { id: "transport", label: "Transport information", patterns: [/\bairport\b/, /\btransfers?\b/, /\bshuttle\b/, /\btaxi\b/, /\bgrab\b/, /\btrain\b/, /\bmrt\b/, /\bbus\b/, /\btram\b/, /\bgetting (there|around)\b/, /\bhow to get\b/, /\btransport\b/], format: "Getting here guide" },
  { id: "itinerary", label: "Local itinerary", patterns: [/\bitinerar(y|ies)\b/, /\bthings to do\b/, /\battractions?\b/, /\bsightseeing\b/, /\bday trips?\b/, /\bwhat to do\b/, /\b\d+ (days?|nights?) in\b/, /\bnearby\b/], format: "Local guide / itinerary" },
  { id: "price", label: "Price & value", patterns: [/\bprices?\b/, /\bcheap\b/, /\bbudget\b/, /\bvalue\b/, /\baffordable\b/, /\bexpensive\b/, /\bcosts?\b/, /\bdeals?\b/, /\brates?\b/, /\boverpriced\b/] },
  { id: "view", label: "Views", patterns: [/\bviews?\b/, /\brooftop\b/, /\bocean\b/, /\bsea ?view\b/, /\bskyline\b/, /\bpanoramic\b/] },
  { id: "beach", label: "Beach", patterns: [/\bbeach(es|front)?\b/, /\bseaside\b/] },
  { id: "service", label: "Service", patterns: [/\bstaff\b/, /\bservice\b/, /\bfriendly\b/, /\bhelpful\b/, /\breception\b/, /\bhospitality\b/, /\bconcierge\b/] },
  { id: "cleanliness", label: "Cleanliness", patterns: [/\bclean(liness)?\b/, /\bdirty\b/, /\bspotless\b/, /\bhygien/, /\bdust/] },
  { id: "noise", label: "Noise", patterns: [/\bnois(e|y)\b/, /\bquiet\b/, /\bloud\b/, /\bpeaceful\b/] },
  { id: "size", label: "Room size", patterns: [/\bsmall\b/, /\bspacious\b/, /\btiny\b/, /\bcramped\b/, /\bsqm\b/, /\bm2\b/, /\bsquare met/] },
  { id: "events", label: "Weddings & events", patterns: [/\bweddings?\b/, /\bevents?\b/, /\bfunctions?\b/, /\bballroom\b/] },
  { id: "fitness", label: "Gym & fitness", patterns: [/\bgym\b/, /\bfitness\b/, /\byoga\b/] },
  { id: "wifi", label: "Wi-Fi", patterns: [/\bwi-?fi\b/, /\binternet\b/] },
  { id: "pets", label: "Pet-friendly", patterns: [/\bpets?\b/, /\bdogs?\b/, /\bpet friendly\b/] },
  { id: "accessibility", label: "Accessibility", patterns: [/\baccessib/, /\bwheelchair\b/, /\blifts?\b/, /\belevators?\b/, /\bstairs\b/] },
  { id: "shopping", label: "Shopping & nightlife", patterns: [/\bshopping\b/, /\bmarkets?\b/, /\bnightlife\b/, /\bnight market\b/, /\bmall\b/] },
  { id: "checkin", label: "Check-in & policies", patterns: [/\bcheck[- ]?in\b/, /\bcheck[- ]?out\b/, /\bpolic(y|ies)\b/, /\bcancell?ation\b/] },
  { id: "safety", label: "Safety", patterns: [/\bsafe(ty)?\b/, /\bsecurity\b/] },
];

export const TOPIC_BY_ID = Object.fromEntries(TOPICS.map((t) => [t.id, t])) as Record<string, Topic>;

export function topicsIn(text: string): string[] {
  const t = fold(text);
  return TOPICS.filter((topic) => topic.patterns.some((p) => p.test(t))).map((topic) => topic.id);
}

/** Map an audience description ("Families, couples, business travellers") to topic ids. */
export function audienceTopics(audience: string | null | undefined): string[] {
  return topicsIn(audience ?? "").filter((id) => ["family", "couples", "business"].includes(id));
}

const GENERIC_TOPICS = new Set(["location", "rooms", "service", "price"]);

/** The most specific topic in a text: generic ones only win when nothing else matches. */
export function primaryTopic(text: string): string | undefined {
  const ts = topicsIn(text);
  return ts.find((t) => !GENERIC_TOPICS.has(t)) ?? ts[0];
}
