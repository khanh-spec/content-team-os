// Content Optimisation Workspace (free mode): rule-based SEO, GEO, brand
// compliance and conversion checks on pasted content.

import { audienceTopics, TOPIC_BY_ID, topicsIn } from "@/lib/intel/lexicon";
import { containsPhrase, contentWords, domainOf, escapeRegex, fold, levenshtein, lines, sentences, words } from "@/lib/intel/text";
import type { Project } from "@/lib/types";

export type Area = "seo" | "geo" | "brand" | "conversion";
export type Check = { id: string; area: Area; status: "pass" | "warn" | "fail"; label: string; detail: string; fix?: string; evidence?: string[] };
export type OptimisationReport = {
  keyword: string | null;
  wordCount: number;
  scores: Record<Area, number>;
  overall: number;
  checks: Check[];
  headings: { level: number; text: string }[];
  requiredEntities?: string[];
};

export type OptimiseInput = {
  content: string;
  keyword?: string | null;
  requiredEntities?: string[];
  /** Feedback rules text (from the Feedback Log) to mine for banned phrases. */
  rules?: string[];
};

// --- parsing -----------------------------------------------------------------

function parse(content: string) {
  const headings: { level: number; text: string }[] = [];
  for (const m of content.matchAll(/^(#{1,6})\s+(.+)$/gm)) headings.push({ level: m[1].length, text: m[2].trim() });
  for (const m of content.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)) headings.push({ level: Number(m[1]), text: m[2].replace(/<[^>]+>/g, "").trim() });
  const links = [...content.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)].map((m) => ({ text: m[1], url: m[2] }));
  for (const m of content.matchAll(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) links.push({ text: m[2].replace(/<[^>]+>/g, ""), url: m[1] });
  const plain = content
    .replace(/<[^>]+>/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>]/g, "");
  const paragraphs = plain.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const wordList = words(plain);
  return { headings, links, plain, paragraphs, wordList, first100: wordList.slice(0, 100).join(" ") };
}

// --- brand rules ---------------------------------------------------------------

/** "❌ Cannot claim Michelin-starred" → "Michelin-starred" */
export function claimPhrase(line: string) {
  return line
    .replace(/^(cannot|can't|can not|must not|never|do not|don't|no|not allowed to)\s+(claim|say|mention|call (us|it)|use|state|promote)\s*(that|a|an|the)?\s*/i, "")
    .replace(/^(no|not)\s+/i, "")
    .replace(/[.]+$/, "")
    .trim();
}

/** Mine feedback rules for phrases the brand never wants to see. */
export function bannedFromRules(rules: string[]): string[] {
  const out: string[] = [];
  for (const r of rules) {
    if (!/\b(never|avoid|don't|do not|stop|not)\b/i.test(r)) continue;
    for (const m of r.matchAll(/["“']([^"”']{3,40})["”']/g)) out.push(m[1]);
    const call = r.match(/\bnever (?:call|describe|refer to) (?:us|it|the (?:hotel|property)) (?:as )?(?:a |an )?([a-z-]+)/i);
    if (call) out.push(call[1]);
  }
  return [...new Set(out.map((s) => s.trim()).filter(Boolean))];
}

const US_UK: [string, string][] = [
  ["color", "colour"], ["center", "centre"], ["favorite", "favourite"], ["traveling", "travelling"], ["traveler", "traveller"],
  ["organize", "organise"], ["realize", "realise"], ["theater", "theatre"], ["neighborhood", "neighbourhood"], ["program", "programme"],
  ["jewelry", "jewellery"], ["catalog", "catalogue"], ["gray", "grey"], ["apologize", "apologise"], ["personalized", "personalised"],
  ["flavor", "flavour"], ["honor", "honour"], ["harbor", "harbour"], ["cozy", "cosy"], ["specialty", "speciality"], ["modernized", "modernised"],
];

// --- main --------------------------------------------------------------------------

export function optimiseContent(project: Project, input: OptimiseInput): OptimisationReport {
  const { headings, links, plain, paragraphs, wordList, first100 } = parse(input.content);
  const keyword = input.keyword?.trim() || null;
  const kw = keyword ? fold(keyword) : "";
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);
  const brand = project.brand_name;
  const brandNames = [brand, ...(project.brand_aliases ?? [])];
  const city = project.city ?? "";
  const allSentences = sentences(plain);
  const wc = wordList.length;

  // ---------- SEO ----------
  if (keyword) {
    const kwWords = contentWords(keyword);
    const coverageOf = (text: string) => (kwWords.length ? kwWords.filter((w) => contentWords(text).includes(w)).length / kwWords.length : 0);
    const h1 = headings.find((h) => h.level === 1);
    add({ id: "kw-h1", area: "seo", status: h1 && coverageOf(h1.text) >= 0.6 ? "pass" : "fail", label: "Keyword in H1 / title", detail: h1 ? `H1: “${h1.text}”` : "No H1 found.", fix: `Put “${keyword}” (or a close variant) in the H1.` });
    add({ id: "kw-intro", area: "seo", status: coverageOf(first100) >= 0.75 ? "pass" : "warn", label: "Keyword in the first 100 words", detail: coverageOf(first100) >= 0.75 ? "Found early in the intro." : "The intro doesn't clearly state the topic.", fix: "Answer the query in the opening paragraph." });
    const h2hit = headings.some((h) => h.level === 2 && coverageOf(h.text) >= 0.5);
    add({ id: "kw-h2", area: "seo", status: h2hit ? "pass" : "warn", label: "Keyword variant in a subheading", detail: h2hit ? "At least one H2 uses the topic." : "No H2 mentions the topic.", fix: "Use a natural keyword variant in one H2." });
    const occurrences = (fold(plain).match(new RegExp(escapeRegex(kw), "g")) ?? []).length;
    const density = wc ? (occurrences * kwWords.length) / wc : 0;
    add({
      id: "kw-density",
      area: "seo",
      status: density > 0.03 ? "warn" : occurrences === 0 ? "warn" : "pass",
      label: "Keyword usage",
      detail: `Exact phrase used ${occurrences}× (${(density * 100).toFixed(1)}% of words).`,
      fix: density > 0.03 ? "Reduce repetition; use synonyms." : occurrences === 0 ? "Use the exact phrase at least once." : undefined,
    });
  } else {
    add({ id: "kw-none", area: "seo", status: "warn", label: "Target keyword", detail: "No target keyword set, so keyword checks were skipped.", fix: "Add a target keyword." });
  }

  const h1s = headings.filter((h) => h.level === 1).length;
  const h2s = headings.filter((h) => h.level === 2).length;
  const skipped = headings.some((h, i) => i > 0 && h.level - headings[i - 1].level > 1);
  add({
    id: "headings",
    area: "seo",
    status: h1s === 1 && (wc < 400 || h2s >= 2) && !skipped ? "pass" : h1s > 1 || skipped ? "fail" : "warn",
    label: "Heading structure",
    detail: `${h1s} H1, ${h2s} H2${skipped ? ", skipped heading levels" : ""}.`,
    fix: h1s !== 1 ? "Use exactly one H1." : skipped ? "Don't jump from H2 to H4." : h2s < 2 ? "Break long content into H2 sections." : undefined,
  });
  add({ id: "length", area: "seo", status: wc >= 600 ? "pass" : wc >= 300 ? "warn" : "fail", label: "Content depth", detail: `${wc.toLocaleString()} words.`, fix: wc < 600 ? "Most competitive hospitality pages run 800+ words." : undefined });

  if (input.requiredEntities?.length) {
    const missing = input.requiredEntities.filter((e) => !containsPhrase(plain, e));
    const ratio = 1 - missing.length / input.requiredEntities.length;
    add({ id: "entities", area: "seo", status: ratio >= 0.7 ? "pass" : ratio >= 0.4 ? "warn" : "fail", label: "Entity coverage", detail: `${Math.round(ratio * 100)}% of the entities top results mention.`, fix: missing.length ? `Mention: ${missing.slice(0, 8).join(", ")}.` : undefined, evidence: missing });
  }

  const site = project.website ? domainOf(project.website) : null;
  const pageUrls = (project.site_pages ?? []).map((p) => p.url);
  const internal = links.filter((l) => l.url.startsWith("/") || (site && domainOf(l.url).endsWith(site)) || pageUrls.includes(l.url));
  add({
    id: "internal-links",
    area: "seo",
    status: internal.length >= 2 ? "pass" : internal.length === 1 ? "warn" : "fail",
    label: "Internal links",
    detail: `${internal.length} internal link${internal.length === 1 ? "" : "s"} found.`,
    fix: internal.length < 2 ? `Link to relevant pages${project.site_pages?.length ? ` (e.g. ${project.site_pages.slice(0, 2).map((p) => p.title).join(", ")})` : " such as rooms, dining or offers"}.` : undefined,
  });

  // ---------- GEO ----------
  const brandIn = (text: string) => brandNames.some((b) => containsPhrase(text, b));
  const distance = /\b\d+(\.\d+)?\s?(-|–)?\s?(min|mins|minutes?|km|kilometres?|kilometers?|m|metres?|meters?|miles?|hours?)\b/i;
  const whereStay = paragraphs.some((p) => brandIn(p) && (!city || containsPhrase(p, city) || distance.test(p)) && distance.test(p));
  add({
    id: "geo-where",
    area: "geo",
    status: whereStay ? "pass" : "fail",
    label: "Can AI answer “Where should I stay?”",
    detail: whereStay ? `A paragraph names ${brand} with a concrete location fact.` : `No paragraph pairs ${brand} with a concrete distance or location fact.`,
    fix: `Add a sentence like “${brand} is a 5-minute walk from …”.`,
  });
  const facts = [...lines(project.brand_facts), ...lines(project.usps)];
  const factHits = facts.filter((f) => {
    const fw = contentWords(f);
    return fw.length && allSentences.some((s) => fw.filter((w) => contentWords(s).includes(w)).length / fw.length >= 0.6);
  });
  add({
    id: "geo-why",
    area: "geo",
    status: factHits.length >= 2 ? "pass" : factHits.length === 1 ? "warn" : "fail",
    label: `Can AI answer “Why choose ${brand}?”`,
    detail: `${factHits.length} approved fact${factHits.length === 1 ? "" : "s"}/USP${factHits.length === 1 ? "" : "s"} stated in the content.`,
    fix: facts.length ? `Work in: ${facts.filter((f) => !factHits.includes(f)).slice(0, 2).join("; ")}.` : "Add approved facts to the brand profile first.",
    evidence: factHits,
  });
  const aud = audienceTopics(project.target_customers);
  const kwAud = topicsIn(keyword ?? "").filter((t) => ["family", "couples", "business"].includes(t));
  const targetAud = kwAud[0] ?? aud[0];
  if (targetAud) {
    const label = TOPIC_BY_ID[targetAud].label.toLowerCase();
    const ok = paragraphs.some((p) => brandIn(p) && topicsIn(p).includes(targetAud));
    add({ id: "geo-audience", area: "geo", status: ok ? "pass" : "warn", label: `Can AI answer “Best option for ${label}?”`, detail: ok ? `${brand} is linked to ${label} in the same paragraph.` : `Nothing ties ${brand} to ${label}.`, fix: `Say plainly why ${brand} suits ${label}, with a fact.` });
  }
  const entityEarly = brandIn(first100) && (!city || containsPhrase(first100, city));
  add({ id: "geo-entity", area: "geo", status: entityEarly ? "pass" : "warn", label: "Brand + location in the first 100 words", detail: entityEarly ? "Strong entity association early on." : `Mention ${brand}${city ? ` and ${city}` : ""} in the opening.`, fix: entityEarly ? undefined : "Name the brand and the destination in the intro." });
  const questionHeads = headings.filter((h) => /\?$/.test(h.text) || /^(how|what|where|when|which|why|is|are|can|do)\b/i.test(h.text)).length;
  add({ id: "geo-faq", area: "geo", status: questionHeads >= 2 ? "pass" : questionHeads === 1 ? "warn" : "fail", label: "Question-led sections / FAQ", detail: `${questionHeads} question-style heading${questionHeads === 1 ? "" : "s"}.`, fix: questionHeads < 2 ? "Add an FAQ with the questions customers actually ask." : undefined });
  const quotable = allSentences.filter((s) => brandIn(s) && /\d/.test(s) && s.split(/\s+/).length <= 35).length;
  add({ id: "geo-quotable", area: "geo", status: quotable >= 2 ? "pass" : quotable === 1 ? "warn" : "fail", label: "Quotable fact sentences", detail: `${quotable} short sentence${quotable === 1 ? "" : "s"} pairing ${brand} with a number.`, fix: quotable < 2 ? "AI answers quote short, specific sentences: brand + fact + number." : undefined });

  // ---------- Brand compliance ----------
  const restricted = lines(project.restricted_claims).map(claimPhrase).filter((p) => p.length > 2);
  const claimHits = restricted.filter((p) => containsPhrase(plain, p));
  add({
    id: "brand-claims",
    area: "brand",
    status: claimHits.length ? "fail" : "pass",
    label: "Restricted claims",
    detail: claimHits.length ? `Content makes restricted claims: ${claimHits.join(", ")}.` : restricted.length ? `None of ${restricted.length} restricted claims found.` : "No restricted claims configured.",
    fix: claimHits.length ? "Remove or rephrase these claims." : undefined,
    evidence: claimHits.flatMap((p) => allSentences.filter((s) => containsPhrase(s, p)).slice(0, 1)),
  });

  const avoid = [...lines(project.words_to_avoid).flatMap((l) => l.split(",")), ...bannedFromRules(input.rules ?? [])].map((s) => s.replace(/["“”]/g, "").trim()).filter((s) => s.length > 2);
  const avoidHits = [...new Set(avoid.filter((w) => containsPhrase(plain, w)))];
  add({ id: "brand-avoid", area: "brand", status: avoidHits.length ? "fail" : "pass", label: "Words to avoid & feedback rules", detail: avoidHits.length ? `Found: ${avoidHits.map((w) => `“${w}”`).join(", ")}.` : "No banned words or phrases.", fix: avoidHits.length ? "Replace with approved vocabulary." : undefined });

  const preferred = lines(project.words_to_use).flatMap((l) => l.split(",")).map((s) => s.trim()).filter((s) => s.length > 2);
  if (preferred.length) {
    const used = preferred.filter((w) => containsPhrase(plain, w));
    add({ id: "brand-vocab", area: "brand", status: used.length ? "pass" : "warn", label: "Preferred vocabulary", detail: `${used.length}/${preferred.length} preferred phrases used.`, fix: used.length ? undefined : `Try: ${preferred.slice(0, 3).join(", ")}.` });
  }

  // Brand-name misspellings: n-grams close to the brand name but not exact.
  const nameIssues: string[] = [];
  const wordsOrig = plain.match(/[\p{L}\p{N}'’&.-]+/gu) ?? [];
  const checkName = (official: string, variants: string[], kind: string) => {
    const size = official.split(/\s+/).length;
    const target = fold(official);
    for (let i = 0; i + size <= wordsOrig.length; i++) {
      const gram = wordsOrig.slice(i, i + size).join(" ").replace(/[.,;:!?)]+$/, "");
      const g = fold(gram);
      if (g === target || variants.some((v) => fold(v) === g)) continue;
      const d = levenshtein(g, target);
      if (d > 0 && d <= Math.max(1, Math.floor(target.length / 8)) && target.length >= 6) nameIssues.push(`${kind}: “${gram}” → “${official}”`);
    }
  };
  checkName(brand, project.brand_aliases ?? [], "Brand");
  for (const c of project.competitors ?? []) checkName(c.name, c.aliases ?? [], "Competitor");
  add({ id: "brand-names", area: "brand", status: nameIssues.length ? "fail" : "pass", label: "Brand & competitor spelling", detail: nameIssues.length ? [...new Set(nameIssues)].join("; ") : "Names are spelled correctly.", fix: nameIssues.length ? "Use the exact official names." : undefined });

  const competitorMentions = (project.competitors ?? []).filter((c) => [c.name, ...(c.aliases ?? [])].some((n) => containsPhrase(plain, n)));
  add({
    id: "brand-competitors",
    area: "brand",
    status: competitorMentions.length ? "warn" : "pass",
    label: "Competitor mentions",
    detail: competitorMentions.length ? `Mentions ${competitorMentions.map((c) => c.name).join(", ")}.` : "No competitors mentioned.",
    fix: competitorMentions.length ? "Only mention competitors for destination context; keep the brand as the main solution." : undefined,
  });

  // Figures not backed by approved facts.
  const factText = fold([project.brand_facts, project.usps, project.products].filter(Boolean).join(" "));
  const figure = /\b(\d[\d,.]*)\s?(rooms?|suites?|villas?|keys|minutes?|mins?|km|metres?|meters?|m2|sqm|restaurants?|bars?|pools?|floors?|storeys?|stars?|%|percent|years?)\b/gi;
  const unverified = allSentences
    .filter((s) => brandIn(s) || /\b(we|our|the hotel|the resort|the property)\b/i.test(s))
    .flatMap((s) => [...s.matchAll(figure)].filter((m) => !factText.includes(fold(m[1]).replace(/,/g, ""))).map((m) => `${m[0]} — “${s.length > 110 ? `${s.slice(0, 107)}…` : s}”`));
  add({
    id: "brand-figures",
    area: "brand",
    status: unverified.length ? "warn" : "pass",
    label: "Figures match approved facts",
    detail: unverified.length ? `${unverified.length} figure${unverified.length === 1 ? "" : "s"} not found in approved facts.` : "Every brand figure matches the approved facts.",
    fix: unverified.length ? "Check these against the fact sheet or remove them." : undefined,
    evidence: unverified.slice(0, 6),
  });

  const variant = fold(project.english_variant ?? "British English");
  const wantUK = /british|uk|australian|au|nz/.test(variant);
  const wrong = US_UK.map(([us, uk]) => (wantUK ? us : uk)).filter((w) => new RegExp(`\\b${w}(s|ed|ing)?\\b`, "i").test(plain));
  add({ id: "brand-english", area: "brand", status: wrong.length ? "warn" : "pass", label: `${project.english_variant || "British English"} spelling`, detail: wrong.length ? `Other-variant spellings: ${wrong.join(", ")}.` : "Spelling matches the brand variant.", fix: wrong.length ? `Switch to ${wantUK ? "British" : "American"} spelling.` : undefined });

  // ---------- Conversion ----------
  const ctaRe = /\b(book( now| your stay| direct)?|reserve|check availability|plan your (stay|trip)|enquire|inquire|contact us|get in touch|call us|request a quote|view rooms|see offers|discover more)\b/i;
  const ctas = allSentences.filter((s) => ctaRe.test(s));
  add({ id: "cta", area: "conversion", status: ctas.length ? "pass" : "fail", label: "Call to action", detail: ctas.length ? `${ctas.length} CTA${ctas.length === 1 ? "" : "s"} found.` : "No call to action.", fix: ctas.length ? undefined : project.cta_preference ? `Add the preferred CTA: ${project.cta_preference}.` : "End with one clear next step." });
  if (project.cta_preference) {
    const prefWords = contentWords(project.cta_preference);
    const ok = allSentences.some((s) => prefWords.filter((w) => contentWords(s).includes(w)).length / Math.max(1, prefWords.length) >= 0.6);
    add({ id: "cta-pref", area: "conversion", status: ok ? "pass" : "warn", label: "Preferred CTA wording", detail: ok ? "Uses the brand's preferred CTA." : `Preferred: “${project.cta_preference}”.` });
  }
  const tail = allSentences.slice(Math.floor(allSentences.length * 0.75)).join(" ");
  add({ id: "cta-end", area: "conversion", status: ctaRe.test(tail) ? "pass" : "warn", label: "CTA near the end", detail: ctaRe.test(tail) ? "The piece closes with a next step." : "The ending has no next step.", fix: ctaRe.test(tail) ? undefined : "Close with a CTA." });
  const bookingLink = links.some((l) => /book|reserv|availability|offers?|rooms?/i.test(`${l.url} ${l.text}`));
  add({ id: "cta-link", area: "conversion", status: bookingLink ? "pass" : "warn", label: "Link to rooms / booking / offers", detail: bookingLink ? "Links to a conversion page." : "No link to rooms, offers or booking.", fix: bookingLink ? undefined : "Link the CTA to the booking or rooms page." });

  // ---------- scores ----------
  const score = (area: Area) => {
    const cs = checks.filter((c) => c.area === area);
    if (!cs.length) return 100;
    return Math.round((cs.reduce((a, c) => a + (c.status === "pass" ? 1 : c.status === "warn" ? 0.5 : 0), 0) / cs.length) * 100);
  };
  const scores = { seo: score("seo"), geo: score("geo"), brand: score("brand"), conversion: score("conversion") };
  const overall = Math.round(scores.seo * 0.3 + scores.geo * 0.25 + scores.brand * 0.3 + scores.conversion * 0.15);
  return { keyword, wordCount: wc, scores, overall, checks, headings, requiredEntities: input.requiredEntities };
}
