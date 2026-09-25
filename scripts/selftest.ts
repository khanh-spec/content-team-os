import JSZip from "jszip";
import { extractText, chunkText } from "../src/lib/extract";
import { parseGscCsv, classify } from "../src/lib/gsc/opportunities";
import { sameBusiness, normalizeName } from "../src/lib/names";
import { aggregate } from "../src/lib/research/visibility";
import type { Project } from "../src/lib/types";

const assert = (c: unknown, m: string) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok:", m); };

async function docx() {
  const z = new JSZip();
  z.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  z.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  z.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Anio has 42 rooms.</w:t></w:r></w:p><w:p><w:r><w:t>Rooftop pool open 7am–8pm.</w:t></w:r></w:p></w:body></w:document>`);
  return z.generateAsync({ type: "nodebuffer" });
}
async function pptx() {
  const z = new JSZip();
  z.file("ppt/slides/slide2.xml", `<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>Slide two &amp; more</a:t></a:r></a:p></p:sld>`);
  z.file("ppt/slides/slide1.xml", `<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>Brand </a:t></a:r><a:r><a:t>Guidelines</a:t></a:r></a:p><a:p><a:r><a:t>Tone: warm</a:t></a:r></a:p></p:sld>`);
  z.file("ppt/slides/slide10.xml", `<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>Slide ten</a:t></a:r></a:p></p:sld>`);
  return z.generateAsync({ type: "nodebuffer" });
}
function pdf() {
  const stream = "BT /F1 18 Tf 72 720 Td (Anio Boutique Hotel fact sheet 42 rooms) Tj ET";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n"; const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

(async () => {
  const d = await extractText(await docx(), "facts.docx");
  assert(d.includes("42 rooms") && d.includes("Rooftop pool"), `docx → ${JSON.stringify(d)}`);
  const p = await extractText(await pptx(), "deck.pptx");
  assert(p.indexOf("Brand Guidelines") < p.indexOf("Slide two & more") && p.indexOf("Slide two") < p.indexOf("Slide ten"), `pptx order → ${JSON.stringify(p)}`);
  const f = await extractText(pdf(), "facts.pdf", "application/pdf");
  assert(f.includes("42 rooms"), `pdf → ${JSON.stringify(f)}`);
  const m = await extractText(Buffer.from("# Title\n\n\n\nBody"), "a.md");
  assert(m === "# Title\n\nBody", "md cleaned");
  try { await extractText(Buffer.from("x"), "old.doc"); assert(false, "doc should throw"); } catch (e) { assert(/Legacy/.test((e as Error).message), "legacy doc rejected"); }

  const chunks = chunkText(Array.from({ length: 30 }, (_, i) => `Paragraph ${i} ` + "word ".repeat(40)).join("\n\n"));
  assert(chunks.length > 3 && chunks.every((c) => c.length <= 1400), `chunking (${chunks.length} chunks)`);

  assert(sameBusiness("Anio Boutique Hotel Hoi An", "Anio Boutique Hotel Hoi An") , "same name");
  assert(sameBusiness("Little Hoi An . A Boutique Hotel & Spa", "Little Hoi An Boutique Hotel"), "variant names match");
  assert(!sameBusiness("Hoi An", "Little Hoi An Boutique Hotel"), "city name alone doesn't match a hotel");
  assert(normalizeName("Khách sạn Đà Nẵng") === "khach san da nang", "diacritics stripped");

  const project = { brand_name: "Anio Boutique Hotel Hoi An", brand_aliases: ["Anio Hotel"], competitors: [{ name: "Little Hoi An Boutique Hotel" }, { name: "Allegro Hoi An" }], website: "https://aniohotel.com", city: "Hoi An" } as unknown as Project;

  const csv = `Top queries,Clicks,Impressions,CTR,Position\n"anio hotel hoi an",120,900,13.3%,1.2\nwhere to stay in hoi an with kids,4,800,0.5%,9.4\nlittle hoi an vs anio,1,60,1.67%,4.1\n"best boutique hotel, hoi an",2,1500,0.13%,14\n`;
  const rows = parseGscCsv(csv);
  assert(rows.length === 4 && rows[3].query === "best boutique hotel, hoi an" && Math.abs((rows[0].ctr ?? 0) - 0.133) < 1e-6, "GSC CSV parsed (quoted comma, % CTR)");
  const opp = classify(rows, project);
  const byQ = Object.fromEntries(opp.map((o) => [o.query, o]));
  assert(byQ["anio hotel hoi an"].pillar === "company", "branded → company");
  assert(byQ["little hoi an vs anio"].pillar === "competitors", "competitor/vs → competitors");
  assert(byQ["where to stay in hoi an with kids"].pillar === "customers" && byQ["where to stay in hoi an with kids"].signals.includes("question") && byQ["where to stay in hoi an with kids"].tail === "long", "question long-tail → customers");
  assert(byQ["best boutique hotel, hoi an"].signals.includes("striking distance"), "striking distance flagged");

  const plan = { prompts: [{ prompt: "p0", angle: "seed" }, { prompt: "p1", angle: "couples" }], iterations: 2 };
  const baseline = { maps: [{ position: 1, title: "Allegro Hoi An . Little Luxury Hotel & Spa" }, { position: 2, title: "Anio Boutique Hotel Hoi An" }, { position: 3, title: "Some Villa" }], localPack: [{ position: 1, title: "Anio Boutique Hotel Hoi An" }], errors: [] };
  const mk = (pi: number, it: number, names: string[], cites: string[] = []) => ({ prompt_index: pi, iteration: it, prompt: `p${pi}`, answer: "x", error: null,
    mentions: names.map((n, i) => ({ name: n, canonical: n, position: i + 1, sentiment: "positive" as const, context: "" })),
    citations: cites.map((u) => ({ url: u, title: "", domain: new URL(u).hostname.replace(/^www\./, "") })) });
  const samples = [
    mk(0, 0, ["Little Hoi An Boutique Hotel", "Anio Hotel", "Anio Boutique Hotel Hoi An"], ["https://www.tripadvisor.com/x", "https://aniohotel.com/rooms"]),
    mk(0, 1, ["Little Hoi An Boutique Hotel", "La Siesta"]),
    mk(1, 0, ["Anio Boutique Hotel Hoi An", "La Siesta"], ["https://www.booking.com/y"]),
    { prompt_index: 1, iteration: 1, prompt: "p1", answer: null, mentions: null, citations: null, error: "boom" },
  ];
  const s = aggregate(project, plan, baseline as never, samples as never);
  const get = (n: string) => s.businesses.find((b) => b.name === n)!;
  assert(s.successful_samples === 3 && s.total_samples === 4, "failed samples excluded");
  assert(get("Anio Boutique Hotel Hoi An").ai_samples === 2 && Math.abs(s.brand!.ai_mention_rate - 2 / 3) < 1e-9, `brand counted once per answer across aliases (${s.brand?.ai_mention_rate})`);
  assert(s.brand!.gap === "both" && s.brand!.maps_rank === 2 && s.brand!.local_pack_rank === 1, "brand maps/local pack joined");
  assert(get("Little Hoi An Boutique Hotel").role === "competitor" && get("Little Hoi An Boutique Hotel").gap === "ai_only", "competitor ai_only");
  assert(get("Allegro Hoi An").gap === "serp_only", `serp-only competitor (${JSON.stringify(s.businesses.map((b) => b.name))})`);
  assert(s.citation_domains.find((d) => d.domain === "aniohotel.com")?.kind === "brand site" && s.citation_domains.find((d) => d.domain === "booking.com")?.kind === "OTA", "citation domains classified");
  assert(s.per_prompt[0].brand_rate === 0.5 && s.per_prompt[1].brand_rate === 1, "per-prompt brand rate");
})();

// ---------------------------------------------------------------------------
// Rules engine (Free Intelligence mode)
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { classifyIntent } from "../src/lib/intel/intent";
import { analyseSerp, type SerpInput } from "../src/lib/intel/serp";
import { buildBrief } from "../src/lib/intel/brief";
import { optimiseContent, claimPhrase, bannedFromRules } from "../src/lib/intel/optimise";
import { reviewThemes } from "../src/lib/intel/reviews";
import { collectQuestions } from "../src/lib/intel/questions";
import { freeOpportunityReport } from "../src/lib/intel/plan";
import { knowledgeScore } from "../src/lib/intel/knowledge";

(async () => {
  const ok = (c: unknown, m: string) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok:", m); };

  ok(classifyIntent("best hotels in Adelaide CBD").primary === "Commercial investigation", "intent: best hotels → commercial investigation");
  ok(classifyIntent("best things to do in Adelaide").label === "Commercial + Informational", `intent label combines (${classifyIntent("best things to do in Adelaide").label})`);
  ok(classifyIntent("book hotel indigo adelaide", ["Hotel Indigo Adelaide"]).all.includes("Navigational"), "intent: brand name → navigational");
  ok(classifyIntent("hotels near adelaide oval").all.includes("Local"), "intent: near → local");

  const indigo = {
    brand_name: "Hotel Indigo Adelaide", brand_aliases: ["Hotel Indigo"], city: "Adelaide", region: "South Australia", country: "Australia", country_code: "au",
    industry: "Hospitality", property_type: "Boutique hotel", website: "https://www.ihg.com/hotelindigo/adelaide",
    brand_facts: "142 rooms\n5-minute walk to Adelaide Central Market\nRooftop bar with city views\nOn-site parking available", usps: "Next to Adelaide Central Market\nRooftop bar", products: "Rooms, rooftop bar, restaurant",
    restricted_claims: "Cannot claim Michelin-starred\nCannot claim private beach", words_to_avoid: "world-class, hidden gem, unforgettable", words_to_use: "thoughtfully designed, local experience",
    target_customers: "Families visiting Adelaide; couples on weekend breaks; business travellers", cta_preference: "Check availability", english_variant: "British English",
    competitors: [{ name: "Mayfair Hotel" }, { name: "The Playford Adelaide" }], site_pages: [{ title: "Rooms & Suites", url: "https://www.ihg.com/hotelindigo/adelaide/rooms" }, { title: "Rooftop bar", url: "https://www.ihg.com/hotelindigo/adelaide/bar" }, { title: "Parking & getting here", url: "https://www.ihg.com/hotelindigo/adelaide/parking" }],
  } as unknown as Project;

  const raw = JSON.parse(readFileSync(new URL("./fixtures/adelaide-serp.json", import.meta.url), "utf8"));
  const serp = analyseSerp(indigo, { query: "best hotels in Adelaide CBD", ...raw } as SerpInput);
  ok(serp.intent.primary === "Commercial investigation", "SERP: intent");
  ok(serp.serpFeatures.includes("People Also Ask") && serp.serpFeatures.includes("Related searches"), `SERP features (${serp.serpFeatures.join(", ")})`);
  const ents = serp.topEntities.map((e) => e.name);
  ok(ents.some((e) => /Mayfair/.test(e)) && ents.some((e) => /Playford/.test(e)), `entities include Mayfair & Playford (${ents.join(", ")})`);
  ok(!ents.includes("Adelaide") && !ents.some((e) => /^(Best|Top|Hotels?)$/i.test(e)), "entities exclude the city and generic words");
  ok(serp.contentFormats.some((f) => f.format === "OTA listing") && serp.contentFormats.some((f) => f.format === "Listicle"), `formats (${serp.contentFormats.map((f) => f.format).join(", ")})`);
  const gapIds = serp.missingOpportunities.map((g) => g.topic);
  ok(gapIds.includes("family") && gapIds.includes("itinerary") && gapIds.includes("transport"), `missing opportunities: family/itinerary/transport (${gapIds.join(", ")})`);
  ok(gapIds.includes("parking") || gapIds.includes("breakfast"), "gaps from related searches (parking/breakfast)");
  ok(serp.missingOpportunities.find((g) => g.topic === "parking")?.brandCanAnswer === true, "gap flags that brand facts cover parking");
  ok(serp.customerQuestions.length >= 3 && serp.customerQuestions[0].sources.includes("People Also Ask"), "customer questions collected, PAA first");
  ok(serp.recommendations.length >= 3, `recommendations (${serp.recommendations.length})`);

  const brief = buildBrief(indigo, "Best things to do in Adelaide", serp);
  ok(brief.audience.some((a) => /famil/i.test(a)), `brief audience (${brief.audience.join(" | ")})`);
  ok(brief.brandIntegration.some((b) => /Central Market/.test(b.detail)), "brief uses the location fact");
  ok(brief.internalLinks.length >= 1, `brief internal links (${brief.internalLinks.map((l) => l.title).join(", ")})`);
  ok(brief.outline[0].heading === "Quick answer" && brief.outline.some((o) => o.heading === "FAQs"), "brief outline has quick answer + FAQs");

  const draft = `# Best hotels in Adelaide CBD

Hotel Indigo Adelaide is a world-class hidden gem with 150 rooms and a Michelin-starred restaurant. Hotel Indgo Adelaide is the best choice.

## Things to do

The Mayfair Hotel is nice too. Our favorite spot is the city center.`;
  const rep = optimiseContent(indigo, { content: draft, keyword: "best hotels in Adelaide CBD", requiredEntities: ["Adelaide Central Market", "Adelaide Oval"], rules: ['Never call us a "resort"'] });
  const st = (id: string) => rep.checks.find((c) => c.id === id)?.status;
  ok(st("kw-h1") === "pass", "optimise: keyword in H1");
  ok(st("brand-claims") === "fail", "optimise: restricted claim (Michelin-starred) caught");
  ok(st("brand-avoid") === "fail", "optimise: words to avoid caught");
  ok(st("brand-names") === "fail" && /Indgo/.test(rep.checks.find((c) => c.id === "brand-names")!.detail), "optimise: brand misspelling caught");
  ok(st("brand-competitors") === "warn", "optimise: competitor mention flagged");
  ok(st("brand-figures") === "warn", "optimise: 150 rooms not in approved facts (142)");
  ok(st("brand-english") === "warn", "optimise: US spelling in British English content");
  ok(st("cta") === "fail" && st("geo-where") === "fail" && st("entities") === "fail", "optimise: missing CTA, location answer, entities");
  ok(rep.overall < 50, `optimise: low overall score for weak draft (${rep.overall})`);

  const good = `# Best hotels in Adelaide CBD: why guests choose Hotel Indigo Adelaide

Hotel Indigo Adelaide is a boutique hotel in the Adelaide CBD with 142 rooms, a 5-minute walk to Adelaide Central Market. Its rooftop bar with city views is a thoughtfully designed local experience.

## Where should families stay in Adelaide?

Families like Hotel Indigo Adelaide because on-site parking is available and Adelaide Central Market is a 5-minute walk away. Adelaide Oval is a short tram ride.

## What is near the hotel?

Adelaide Central Market and Adelaide Oval are both easy to reach. See our [rooms](https://www.ihg.com/hotelindigo/adelaide/rooms) and [rooftop bar](https://www.ihg.com/hotelindigo/adelaide/bar).

Check availability for your dates and [book your stay](https://www.ihg.com/hotelindigo/adelaide/rooms).`;
  const rep2 = optimiseContent(indigo, { content: good, keyword: "best hotels in Adelaide CBD", requiredEntities: ["Adelaide Central Market", "Adelaide Oval"] });
  ok(rep2.overall > rep.overall + 30, `optimise: strong draft scores much higher (${rep2.overall} vs ${rep.overall})`);
  ok(["brand-claims", "brand-avoid", "brand-names", "geo-where", "geo-why", "geo-audience", "cta", "internal-links", "entities"].every((id) => rep2.checks.find((c) => c.id === id)?.status === "pass"), `optimise: strong draft passes key checks (${rep2.checks.filter((c) => c.status !== "pass").map((c) => c.id).join(",")})`);

  ok(claimPhrase("❌ Cannot claim Michelin-starred".replace("❌ ", "")) === "Michelin-starred", "claimPhrase strips the rule wording");
  ok(bannedFromRules(['Never call us a resort.', 'Avoid "hidden gem"']).join("|") === "resort|hidden gem" || bannedFromRules(['Never call us a resort.', 'Avoid "hidden gem"']).length === 2, "banned phrases mined from feedback rules");

  const themes = reviewThemes([
    { source: "Google", place: "X", rating: 5, text: "Great location and the breakfast was delicious. Staff were friendly." },
    { source: "Google", place: "X", rating: 2, text: "The room was small and noisy. Parking was expensive." },
  ]);
  ok(themes.positive.some((t) => t.topic === "breakfast") && themes.negative.some((t) => t.topic === "noise"), "review themes: positive breakfast, negative noise");
  const qs = collectQuestions([{ text: "Is Ubud suitable for families?", source: "Reddit" }, { text: "is ubud good for families", source: "People Also Ask", weight: 2 }, { text: "Ubud hotels", source: "Related searches" }]);
  ok(qs.length === 1 && qs[0].frequency === "High" && qs[0].intent.startsWith("Family travel"), `questions merged across sources (${JSON.stringify(qs.map((q) => [q.question, q.frequency, q.intent]))})`);

  const plan = freeOpportunityReport(indigo, [
    { query: "hotel indigo adelaide parking", clicks: 5, impressions: 400, ctr: 0.0125, position: 3.1, pillar: "company", signals: ["branded", "low CTR for position"], tail: "long", score: 50 },
    { query: "things to do near adelaide central market", clicks: 1, impressions: 900, ctr: 0.001, position: 14, pillar: "customers", signals: ["striking distance"], tail: "long", score: 90 },
  ]);
  ok(plan.briefs.length === 2 && plan.briefs.some((b) => b.action === "local_guide") && plan.briefs.some((b) => b.action === "title_meta_rewrite"), "free content plan: actions from signals");

  const ks = knowledgeScore(indigo, { documents: 0, rules: 0, research: 0 });
  ok(ks.score > 50 && ks.missing.some((m) => m.label === "Brand documents"), `knowledge score (${ks.score}%)`);
})();

import { extractEntities } from "../src/lib/intel/entities";
(() => {
  const e = extractEntities(["Stay near Hoi An Old Town and An Bang Beach", "An Bang Beach is quiet. Hoi An Old Town is busy.", "Hoi An night market"], { exclude: ["Hoi An", "Vietnam"] }).map((x) => x.name);
  const pass = e.includes("An Bang Beach") && e.includes("Hoi An Old Town") && !e.includes("Hoi") && !e.includes("Bang Beach");
  if (!pass) { console.error("FAIL: entities keep Vietnamese names intact", e); process.exitCode = 1; } else console.log("ok: entities keep Vietnamese names intact", e.join(", "));
})();

import { titleCase } from "../src/lib/intel/text";
if (titleCase("where to stay in hoi an for couples") !== "Where to Stay in Hoi An for Couples") { console.error("FAIL: titleCase", titleCase("where to stay in hoi an for couples")); process.exitCode = 1; } else console.log("ok: headline case");
