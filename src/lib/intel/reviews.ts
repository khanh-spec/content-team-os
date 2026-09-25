// Review theme analysis: which topics guests praise or complain about.

import { TOPIC_BY_ID, topicsIn } from "@/lib/intel/lexicon";
import { fold, sentences } from "@/lib/intel/text";

export type ReviewInput = { source: string; place: string; rating?: number; text: string };
export type Theme = { topic: string; label: string; count: number; examples: string[] };
export type ThemeSummary = { positive: Theme[]; negative: Theme[]; reviews: number };

const NEG = /\b(not|n't|no|never|but|however|although|small|tiny|cramped|noisy|loud|dirty|smell|smelly|expensive|overpriced|pricey|rude|slow|far|old|dated|broken|disappoint\w*|poor|bad|worst|issues?|problems?|lack(ing)?|limited|mediocre|average|uncomfortable|hard|difficult|crowded|busy|wait(ed|ing)?)\b/;
const POS = /\b(great|excellent|amazing|lovely|friendly|clean|perfect|delicious|beautiful|spacious|helpful|comfortable|best|good|nice|wonderful|fantastic|superb|awesome|loved?|convenient|quiet|stunning|attentive|recommend(ed)?|brilliant|gorgeous|fresh|central)\b/;

function sentiment(sentence: string, rating?: number): 1 | -1 | 0 {
  const s = fold(sentence);
  const neg = (s.match(new RegExp(NEG, "g")) ?? []).length;
  const pos = (s.match(new RegExp(POS, "g")) ?? []).length;
  if (pos > neg) return 1;
  if (neg > pos) return -1;
  if (rating != null) return rating >= 4 ? 1 : rating <= 2 ? -1 : 0;
  return 0;
}

export function reviewThemes(reviews: ReviewInput[], limit = 6): ThemeSummary {
  const pos = new Map<string, Theme>();
  const neg = new Map<string, Theme>();
  for (const r of reviews) {
    const seenPos = new Set<string>();
    const seenNeg = new Set<string>();
    for (const s of sentences(r.text)) {
      const topics = topicsIn(s).filter((t) => !["rooms"].includes(t) || topicsIn(s).length === 1);
      if (!topics.length) continue;
      const v = sentiment(s, r.rating);
      if (!v) continue;
      for (const t of topics) {
        const bucket = v > 0 ? pos : neg;
        const seen = v > 0 ? seenPos : seenNeg;
        if (seen.has(t)) continue;
        seen.add(t);
        const th = bucket.get(t) ?? { topic: t, label: TOPIC_BY_ID[t].label, count: 0, examples: [] };
        th.count++;
        if (th.examples.length < 3) th.examples.push(s.length > 160 ? `${s.slice(0, 157)}…` : s);
        bucket.set(t, th);
      }
    }
  }
  const top = (m: Map<string, Theme>) => [...m.values()].sort((a, b) => b.count - a.count).slice(0, limit);
  return { positive: top(pos), negative: top(neg), reviews: reviews.length };
}
