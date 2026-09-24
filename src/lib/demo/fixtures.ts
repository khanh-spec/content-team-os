// Sample workspace shown in preview mode (no Supabase configured).
// All businesses and facts here are fictional.

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const P3 = "33333333-3333-4333-8333-333333333333";

const now = Date.now();
const ago = (days: number) => new Date(now - days * 86_400_000).toISOString();

export const DEMO_USER = {
  id: "00000000-0000-4000-8000-000000000000",
  email: "preview@headsonpillows.com",
  user_metadata: { full_name: "Khanh" },
};

const project = (over: Record<string, unknown>) => ({
  brand_aliases: [],
  website: null,
  industry: "Hospitality",
  property_type: null,
  city: null,
  region: null,
  country: null,
  country_code: null,
  language: "en",
  serp_location: null,
  latitude: null,
  longitude: null,
  brand_summary: null,
  usps: null,
  brand_facts: null,
  tone_of_voice: null,
  words_to_use: null,
  words_to_avoid: null,
  target_customers: null,
  competitors: [],
  notes: null,
  created_by: DEMO_USER.id,
  created_at: ago(40),
  updated_at: ago(1),
  ...over,
});

const projects = [
  project({
    id: P1,
    name: "Sample · Lantern House Hoi An",
    brand_name: "Lantern House Hoi An",
    brand_aliases: ["Lantern House"],
    website: "https://lanternhouse.example",
    property_type: "Boutique hotel",
    city: "Hoi An",
    region: "Quang Nam",
    country: "Vietnam",
    country_code: "vn",
    serp_location: "Hoi An, Quang Nam Province, Vietnam",
    brand_summary: "A 28-room boutique hotel on the Thu Bon riverbank, a 6-minute walk from the Japanese Covered Bridge, known for its lantern-making workshops and rooftop breakfast.",
    usps: "Riverside rooms with balconies\nFree daily lantern-making workshop\nRooftop breakfast overlooking the old town",
    brand_facts: "28 rooms and suites\n6-minute walk to the Japanese Covered Bridge\nRooftop pool open 7am–9pm\nFree bicycles for guests\nAirport transfer from Da Nang: 45 minutes, bookable at reception",
    tone_of_voice: "Warm, understated, locally knowledgeable. Short sentences. No hype.",
    words_to_use: "riverside, old town, lantern, slow mornings",
    words_to_avoid: "hidden gem, nestled, luxury (we are boutique, not luxury), resort",
    target_customers: "Couples 28–45 from Australia, UK and Korea on a 3–4 night central Vietnam trip; small families wanting walkable access to the old town.",
    competitors: [
      { name: "Riverbend Boutique Villa", website: "https://riverbend.example" },
      { name: "Old Quarter Heritage Hotel", website: "https://oldquarter.example", aliases: ["OQ Heritage"] },
    ],
  }),
  project({
    id: P2,
    name: "Sample · Samui Hillside Retreat",
    brand_name: "Samui Hillside Retreat",
    property_type: "Adults-only resort",
    city: "Koh Samui",
    country: "Thailand",
    country_code: "th",
    brand_summary: "An adults-only hillside resort above Maenam Bay with 40 pool villas and panoramic ocean views.",
    competitors: [{ name: "Maenam Cliff Villas" }],
    updated_at: ago(3),
  }),
  project({
    id: P3,
    name: "Sample · Harbourside Self Storage",
    brand_name: "Harbourside Self Storage",
    industry: "Self-storage",
    city: "Sydney",
    country: "Australia",
    country_code: "au",
    brand_summary: "Mobile storage and moving services across Sydney's inner west.",
    updated_at: ago(8),
  }),
];

const documents = [
  { id: "d1000000-0000-4000-8000-000000000001", project_id: P1, title: "Lantern House brand guidelines 2026", category: "brand_guideline", source: "upload", storage_path: `${P1}/brand-guidelines.pdf`, mime_type: "application/pdf", size_bytes: 2_400_000, content_text: null, status: "ready", error: null, created_at: ago(30) },
  { id: "d1000000-0000-4000-8000-000000000002", project_id: P1, title: "Room types & amenities", category: "fact_sheet", source: "paste", storage_path: null, mime_type: "text/markdown", size_bytes: 3_100, content_text: null, status: "ready", error: null, created_at: ago(28) },
  { id: "d1000000-0000-4000-8000-000000000003", project_id: P1, title: "Approved blog: 48 hours in Hoi An", category: "writing_sample", source: "upload", storage_path: `${P1}/48-hours.docx`, mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size_bytes: 88_000, content_text: null, status: "ready", error: null, created_at: ago(21) },
  { id: "d1000000-0000-4000-8000-000000000004", project_id: P1, title: "Q3 content brief", category: "requirement", source: "upload", storage_path: `${P1}/q3-brief.pptx`, mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", size_bytes: 1_200_000, content_text: null, status: "ready", error: null, created_at: ago(9) },
  { id: "d2000000-0000-4000-8000-000000000001", project_id: P2, title: "Villa fact sheet", category: "fact_sheet", source: "paste", storage_path: null, mime_type: "text/markdown", size_bytes: 1_900, content_text: null, status: "ready", error: null, created_at: ago(12) },
];

const feedback_logs = [
  { id: "f1000000-0000-4000-8000-000000000001", project_id: P1, draft_id: "c1000000-0000-4000-8000-000000000001", source: "client", kind: "rule", content: "Never call us a resort. We are a boutique hotel.", context: "…the charming riverside resort…", status: "open", apply_as_rule: true, author_name: "GM, Lantern House", created_at: ago(6), resolved_at: null },
  { id: "f1000000-0000-4000-8000-000000000002", project_id: P1, draft_id: null, source: "client", kind: "fact_correction", content: "The rooftop pool closes at 9pm, not 10pm.", context: null, status: "applied", apply_as_rule: true, author_name: "Marketing lead", created_at: ago(14), resolved_at: ago(13) },
  { id: "f1000000-0000-4000-8000-000000000003", project_id: P1, draft_id: "c1000000-0000-4000-8000-000000000002", source: "editor", kind: "feedback", content: "Intro is too long. Get to the lantern workshop in the first 80 words.", context: null, status: "open", apply_as_rule: false, author_name: "Khanh", created_at: ago(2), resolved_at: null },
  { id: "f1000000-0000-4000-8000-000000000004", project_id: P1, draft_id: null, source: "internal", kind: "rule", content: "Use UK English spelling (colour, centre) for all Lantern House content.", context: null, status: "open", apply_as_rule: true, author_name: null, created_at: ago(20), resolved_at: null },
];

const analysis = {
  summary: "Fixed two wrong brand facts and one misspelled competitor name, removed the 'resort' wording the client rejected, and added the lantern workshop and walking distance as concrete proof points.",
  fact_checks: [
    { original: "a 2-minute stroll from the Japanese Bridge", issue: "Distance is wrong per the verified brand facts.", correction: "a 6-minute walk from the Japanese Covered Bridge", type: "brand_fact", severity: "high", evidence: "Brand facts" },
    { original: "the rooftop pool is open until 10pm", issue: "Closing time changed.", correction: "the rooftop pool is open 7am–9pm", type: "brand_fact", severity: "high", evidence: "Feedback rule (fact correction, client)" },
    { original: "Riverbend Boutique Villas", issue: "Competitor name misspelled (singular 'Villa').", correction: "Riverbend Boutique Villa", type: "competitor_name", severity: "medium", evidence: "Competitor list" },
    { original: "charming riverside resort", issue: "Client rule: never call the property a resort.", correction: "riverside boutique hotel", type: "brand_name", severity: "medium", evidence: "Feedback rule (client)" },
  ],
  changes: [
    { before: "Nestled in the heart of Hoi An, this hidden gem…", after: "Lantern House sits on the Thu Bon riverbank, six minutes on foot from the Japanese Covered Bridge.", reason: "Removes banned clichés and leads with a checkable fact." },
    { before: "Guests can enjoy many activities.", after: "Every afternoon at 4pm, guests can join a free lantern-making workshop in the courtyard.", reason: "Replaces a vague claim with the brand's USP." },
  ],
  added_facts: [
    { fact: "Free daily lantern-making workshop", source: "[D1] Brand guidelines" },
    { fact: "Free bicycles for guests", source: "Brand facts" },
  ],
  tone_notes: ["Shortened sentences to match the 'understated' tone.", "Switched to UK spelling (colour, centre) per team rule."],
  questions_for_client: ["Is the lantern workshop still daily in the rainy season (Oct–Dec)?", "Can we mention the rooftop breakfast price for non-guests?"],
  seo_geo_notes: ["Answers the PAA question 'Is it better to stay in Hoi An old town or An Bang beach?' in one quotable paragraph.", "Brand name + city now appear together in the first sentence for entity clarity."],
  context_used: { documents: ["Lantern House brand guidelines 2026", "Room types & amenities"], research: ["Local research: where to stay in Hoi An for couples"], rules: 3 },
};

const original = `# Where to stay in Hoi An as a couple

Nestled in the heart of Hoi An, this hidden gem is a charming riverside resort just a 2-minute stroll from the Japanese Bridge. Guests can enjoy many activities and the rooftop pool is open until 10pm.

Nearby, Riverbend Boutique Villas is another option, but it is further from the old town.`;

const revised = `# Where to stay in Hoi An as a couple

Lantern House sits on the Thu Bon riverbank, six minutes on foot from the Japanese Covered Bridge. That puts the lantern-lit old town within an easy evening walk, while the riverside rooms stay quiet at night.

Every afternoon at 4pm, guests can join a free lantern-making workshop in the courtyard. Mornings start with breakfast on the rooftop, and the pool up there is open 7am–9pm. Free bicycles make the 15-minute ride to An Bang beach simple.

## Old town or beach?

If this is your first visit and you want to explore on foot, stay near the old town. Riverbend Boutique Villa is another riverside option, but it sits further from the centre.`;

const content_drafts = [
  { id: "c1000000-0000-4000-8000-000000000001", project_id: P1, title: "Where to stay in Hoi An as a couple", content_type: "Blog article", target_keyword: "where to stay in hoi an for couples", original_content: original, revised_content: revised, analysis, research_run_ids: ["e1000000-0000-4000-8000-000000000001"], status: "review", error: null, created_at: ago(6), updated_at: ago(1) },
  { id: "c1000000-0000-4000-8000-000000000002", project_id: P1, title: "Lantern-making workshop page", content_type: "Landing page", target_keyword: "hoi an lantern making class", original_content: "Join our lantern workshop…", revised_content: null, analysis: null, research_run_ids: [], status: "draft", error: null, created_at: ago(3), updated_at: ago(2) },
  { id: "c1000000-0000-4000-8000-000000000003", project_id: P1, title: "Hoi An old town vs An Bang beach", content_type: "Local guide / listicle", target_keyword: "hoi an old town or an bang beach", original_content: "Planned from the Opportunities plan.", revised_content: null, analysis: null, research_run_ids: [], status: "planned", error: null, created_at: ago(1), updated_at: ago(1) },
  { id: "c1000000-0000-4000-8000-000000000004", project_id: P1, title: "Rooftop breakfast FAQ", content_type: "FAQ", target_keyword: "lantern house breakfast", original_content: "FAQ draft…", revised_content: "FAQ…", analysis: null, research_run_ids: [], status: "complete", error: null, created_at: ago(18), updated_at: ago(10) },
  { id: "c1000000-0000-4000-8000-000000000005", project_id: P1, title: "Deluxe River View room page", content_type: "Room / suite page", target_keyword: "hoi an river view hotel", original_content: "Room copy…", revised_content: "Room copy…", analysis: null, research_run_ids: [], status: "published", error: null, created_at: ago(26), updated_at: ago(15) },
  { id: "c2000000-0000-4000-8000-000000000001", project_id: P2, title: "Adults-only resorts in Koh Samui", content_type: "Blog article", target_keyword: "adults only resort koh samui", original_content: "Draft…", revised_content: null, analysis: null, research_run_ids: [], status: "draft", error: null, created_at: ago(4), updated_at: ago(3) },
  { id: "c2000000-0000-4000-8000-000000000002", project_id: P2, title: "Pool villa page", content_type: "Room / suite page", target_keyword: "koh samui pool villa", original_content: "Draft…", revised_content: null, analysis: null, research_run_ids: [], status: "processing", error: null, created_at: ago(0.1), updated_at: ago(0.1) },
  { id: "c3000000-0000-4000-8000-000000000001", project_id: P3, title: "How much does self storage cost in Sydney?", content_type: "Blog article", target_keyword: "self storage cost sydney", original_content: "Draft…", revised_content: null, analysis: null, research_run_ids: [], status: "draft", error: null, created_at: ago(9), updated_at: ago(8) },
];

const localSummary = {
  overview: "Couples choosing where to stay in Hoi An weigh walkability to the lantern-lit old town against quieter beach stays. Reviews reward riverside calm, bikes and easy evening walks; complaints focus on night-market noise and rooms far from the centre.",
  customer_questions: [
    { question: "Is it better to stay in Hoi An old town or An Bang beach?", source: "PAA", intent: "comparison", brand_can_answer: "yes" },
    { question: "How far is Hoi An from Da Nang airport?", source: "PAA", intent: "planning", brand_can_answer: "yes" },
    { question: "Which area of Hoi An is quiet at night?", source: "Reddit", intent: "local", brand_can_answer: "partially" },
    { question: "Can you walk to the Japanese Bridge from the river hotels?", source: "Tripadvisor", intent: "local", brand_can_answer: "yes" },
    { question: "Are lantern-making classes worth it?", source: "Forums", intent: "informational", brand_can_answer: "yes" },
  ],
  themes: [
    { theme: "Walkability to the old town", sentiment: "positive", evidence: ["Perfect location, 5 minutes to everything", "We walked to the night market every evening"], sources: ["Google reviews", "Tripadvisor"] },
    { theme: "Night-market noise", sentiment: "negative", evidence: ["Music until midnight near the market"], sources: ["Tripadvisor", "Reddit"] },
    { theme: "Free bikes", sentiment: "positive", evidence: ["Loved cycling to An Bang"], sources: ["Booking"] },
  ],
  customer_vocabulary: ["old town", "lantern-lit", "walk everywhere", "quiet at night", "cycle to the beach", "rooftop breakfast"],
  local_facts: [
    { fact: "Da Nang airport to Hoi An is about 45 minutes by car", source: "PAA", confidence: "high" },
    { fact: "The Full Moon Lantern Festival happens monthly on the 14th day of the lunar month", source: "Organic results", confidence: "high" },
    { fact: "An Bang beach is roughly 15 minutes by bike from the old town", source: "Reddit", confidence: "medium" },
  ],
  brand_perception: { summary: "Reviewers praise the riverside calm and the lantern workshop; a few mention small bathrooms in standard rooms.", strengths: ["Location", "Lantern workshop", "Staff"], weaknesses: ["Small standard bathrooms"], found_in_sources: true },
  competitor_insights: [
    { name: "Riverbend Boutique Villa", visibility: "Maps #1, Tripadvisor 4.8★", positioning: "Quiet villa-style stays", strengths: ["Pool", "Reviews volume"], weaknesses: ["20-minute walk to old town"] },
    { name: "Old Quarter Heritage Hotel", visibility: "Local pack #2", positioning: "Heritage building in the old town", strengths: ["Central"], weaknesses: ["Street noise"] },
  ],
  content_angles: [
    { title: "Old town or An Bang beach: where couples should stay", target_query: "hoi an old town or an bang beach", pillar: "customers", why: "Top PAA comparison question the brand can answer with first-hand detail." },
    { title: "How to get from Da Nang airport to Lantern House", target_query: "da nang airport to hoi an", pillar: "company", why: "High-volume planning query; the brand offers a 45-minute transfer." },
    { title: "Lantern House vs Riverbend Boutique Villa", target_query: "riverbend boutique villa hoi an", pillar: "competitors", why: "Walkability is a provable edge over the main competitor." },
  ],
};

const localSources = {
  query: "where to stay in hoi an for couples",
  organic: [{ position: 1, title: "Where to Stay in Hoi An: Best Areas & Hotels", link: "https://example.com/where-to-stay-hoi-an", snippet: "Old town, Cam Thanh, An Bang or Cua Dai…", source: "example.com" }],
  questions: [{ question: "Is it better to stay in Hoi An old town or An Bang beach?", snippet: "The old town suits first-time visitors…" }],
  relatedSearches: ["hoi an hotels near old town", "hoi an romantic hotel"],
  localPack: [{ position: 1, title: "Riverbend Boutique Villa", rating: 4.8, reviews: 1420 }, { position: 2, title: "Old Quarter Heritage Hotel", rating: 4.6, reviews: 980 }, { position: 3, title: "Lantern House Hoi An", rating: 4.7, reviews: 640 }],
  maps: [{ position: 1, title: "Riverbend Boutique Villa", rating: 4.8, reviews: 1420, type: "Hotel" }, { position: 2, title: "Lantern House Hoi An", rating: 4.7, reviews: 640, type: "Hotel" }],
  forums: [{ title: "Quiet area to stay in Hoi An?", link: "https://www.reddit.com/r/VietNam/", snippet: "Stay by the river, not next to the night market…", source: "Reddit · r/VietNam" }],
  reddit: [],
  booking: [],
  tripadvisor: [{ title: "Lantern House Hoi An", place_id: "0", rating: 4.5, reviews: 312 }],
  reviews: [{ source: "Google", place: "Lantern House Hoi An", rating: 5, date: "2 weeks ago", text: "Loved the lantern workshop and the quiet riverside room." }],
  errors: [],
  serpapiCalls: 11,
};

const visSummary = {
  total_samples: 15,
  successful_samples: 15,
  avg_mentions_per_answer: 6.4,
  avg_citations_per_answer: 4.1,
  brand: { name: "Lantern House Hoi An", role: "brand", ai_mentions: 4, ai_samples: 4, ai_mention_rate: 4 / 15, ai_avg_position: 4.5, ai_prompts: 2, sentiment: { positive: 4, neutral: 0, negative: 0 }, maps_rank: 2, maps_rating: 4.7, maps_reviews: 640, local_pack_rank: 3, gap: "both" },
  brand_share_of_voice: 0.042,
  businesses: [
    { name: "Riverbend Boutique Villa", role: "competitor", ai_mentions: 12, ai_samples: 12, ai_mention_rate: 0.8, ai_avg_position: 1.6, ai_prompts: 5, sentiment: { positive: 12, neutral: 0, negative: 0 }, maps_rank: 1, maps_rating: 4.8, maps_reviews: 1420, local_pack_rank: 1, gap: "both" },
    { name: "Anantara Style River Resort", role: "other", ai_mentions: 10, ai_samples: 10, ai_mention_rate: 10 / 15, ai_avg_position: 2.3, ai_prompts: 5, sentiment: { positive: 10, neutral: 0, negative: 0 }, maps_rank: null, maps_rating: null, maps_reviews: null, local_pack_rank: null, gap: "ai_only" },
    { name: "Lantern House Hoi An", role: "brand", ai_mentions: 4, ai_samples: 4, ai_mention_rate: 4 / 15, ai_avg_position: 4.5, ai_prompts: 2, sentiment: { positive: 4, neutral: 0, negative: 0 }, maps_rank: 2, maps_rating: 4.7, maps_reviews: 640, local_pack_rank: 3, gap: "both" },
    { name: "Old Quarter Heritage Hotel", role: "competitor", ai_mentions: 0, ai_samples: 0, ai_mention_rate: 0, ai_avg_position: null, ai_prompts: 0, sentiment: { positive: 0, neutral: 0, negative: 0 }, maps_rank: 3, maps_rating: 4.6, maps_reviews: 980, local_pack_rank: 2, gap: "serp_only" },
  ],
  citation_domains: [
    { domain: "tripadvisor.com", count: 21, kind: "reviews / maps" },
    { domain: "booking.com", count: 14, kind: "OTA" },
    { domain: "travelguide.example", count: 9, kind: "editorial / other" },
    { domain: "reddit.com", count: 6, kind: "forum" },
  ],
  per_prompt: [
    { prompt: "best boutique hotel in Hoi An", angle: "seed", brand_rate: 1 / 3, top: ["Riverbend Boutique Villa", "Anantara Style River Resort"] },
    { prompt: "romantic riverside hotel in Hoi An walking distance to old town", angle: "couples", brand_rate: 2 / 3, top: ["Riverbend Boutique Villa", "Lantern House Hoi An"] },
    { prompt: "quiet hotel in Hoi An for a honeymoon", angle: "honeymoon", brand_rate: 0, top: ["Anantara Style River Resort"] },
  ],
  insights: {
    headline: "Strong on Google Maps, under-recommended by ChatGPT",
    findings: ["Lantern House ranks #2 on Maps but appears in only 27% of ChatGPT answers.", "ChatGPT leans on Tripadvisor and Booking.com; the brand site is never cited."],
    recommendations: [
      { action: "Publish a quotable 'walking distances from Lantern House' section on the rooms page", pillar: "company", priority: "high", why: "Walkability is the most common reason AI answers give for recommending competitors." },
      { action: "Get featured in 2–3 'where to stay in Hoi An' editorial guides that ChatGPT cites", pillar: "competitors", priority: "high", why: "Citations come from editorial and OTA pages, not hotel sites." },
    ],
  },
};

const research_runs = [
  { id: "e1000000-0000-4000-8000-000000000001", project_id: P1, kind: "local_context", query: "where to stay in hoi an for couples", params: { sources: ["google", "maps", "google_reviews", "forums", "reddit", "tripadvisor", "booking"] }, status: "done", sources: localSources, summary: localSummary, error: null, created_by: DEMO_USER.id, created_at: ago(7), completed_at: ago(7) },
  { id: "e1000000-0000-4000-8000-000000000002", project_id: P1, kind: "ai_visibility", query: "best boutique hotel in Hoi An", params: { prompts: visSummary.per_prompt.map((p) => ({ prompt: p.prompt, angle: p.angle })), iterations: 5 }, status: "done", sources: { baseline: { maps: localSources.maps, localPack: localSources.localPack, errors: [] } }, summary: visSummary, error: null, created_by: DEMO_USER.id, created_at: ago(5), completed_at: ago(5) },
];

const visibility_samples = [
  { run_id: "e1000000-0000-4000-8000-000000000002", prompt_index: 1, iteration: 0, prompt: "romantic riverside hotel in Hoi An walking distance to old town", answer: "Here are a few riverside options within walking distance of the old town:\n\n1. **Riverbend Boutique Villa**: calm, villa-style rooms with a pool.\n2. **Lantern House Hoi An**: six minutes from the Japanese Covered Bridge, with a free lantern workshop.", mentions: [{ name: "Riverbend Boutique Villa", canonical: "Riverbend Boutique Villa", position: 1, sentiment: "positive", context: "calm villa-style rooms" }, { name: "Lantern House Hoi An", canonical: "Lantern House Hoi An", position: 2, sentiment: "positive", context: "six minutes from the bridge" }], citations: [{ url: "https://www.tripadvisor.com/", title: "Tripadvisor", domain: "tripadvisor.com" }], error: null },
];

const gsc_queries = [
  ["lantern house hoi an", 410, 1900, 0.216, 1.2],
  ["lantern house hoi an breakfast", 38, 260, 0.146, 1.8],
  ["where to stay in hoi an for couples", 22, 3400, 0.0065, 11.4],
  ["hoi an old town or an bang beach", 9, 2100, 0.0043, 14.8],
  ["is hoi an walkable", 6, 900, 0.0067, 9.1],
  ["riverbend boutique villa vs lantern house", 4, 140, 0.028, 3.9],
  ["hotels near japanese covered bridge", 31, 2600, 0.0119, 7.6],
  ["hoi an lantern making class", 12, 1800, 0.0067, 16.2],
  ["da nang airport to hoi an", 3, 5200, 0.0006, 24.5],
  ["boutique hotel hoi an", 45, 4100, 0.011, 8.3],
  ["hoi an river view hotel", 27, 1500, 0.018, 5.2],
  ["best area to stay in hoi an with kids", 2, 700, 0.0029, 18.7],
].map(([query, clicks, impressions, ctr, position], i) => ({ id: i + 1, project_id: P1, query, page: null, clicks, impressions, ctr, position, period_label: "Last 3 months", imported_at: ago(4) }));

const opportunity_reports = [
  {
    id: "a1000000-0000-4000-8000-000000000001",
    project_id: P1,
    created_at: ago(4),
    report: {
      summary: "Branded demand is healthy, but couples' planning questions and old-town-vs-beach comparisons rank on page 2. Two updates and one new guide would cover the biggest gaps.",
      briefs: [
        { title: "Where to stay in Hoi An as a couple", action: "update_existing", pillar: "customers", primary_query: "where to stay in hoi an for couples", supporting_queries: ["is hoi an walkable", "hotels near japanese covered bridge"], target_page: "https://lanternhouse.example/blog/where-to-stay", customer_questions: ["Which area is quiet at night?", "Can you walk to the old town?"], brand_facts_to_use: ["6-minute walk to the Japanese Covered Bridge", "Free bicycles"], competitor_angle: "Closer to the old town than Riverbend Boutique Villa.", geo_note: "One quotable paragraph answering 'old town or beach' helps AI assistants cite the brand.", priority: "high" },
        { title: "Da Nang airport to Hoi An: transfer guide", action: "new_page", pillar: "company", primary_query: "da nang airport to hoi an", supporting_queries: [], target_page: "new", customer_questions: ["How long is the drive?", "How much does a transfer cost?"], brand_facts_to_use: ["45-minute transfer bookable at reception", "MISSING: transfer price"], competitor_angle: "", geo_note: "Explicit times and prices are what AI answers quote.", priority: "medium" },
      ],
      missing_brand_facts: ["Airport transfer price", "Whether the lantern workshop runs during the rainy season"],
    },
  },
];

export const FIXTURES: Record<string, Record<string, unknown>[]> = {
  projects,
  documents,
  document_chunks: [],
  feedback_logs,
  content_drafts,
  research_runs,
  visibility_samples,
  gsc_queries,
  gsc_connections: [],
  opportunity_reports,
};
