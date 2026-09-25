# SEO/GEO Brand Intelligence Manager (Heads on Pillows)

A brand-trained SEO/GEO operating system for hospitality content teams. It combines SERP intelligence, local market understanding, customer insight, competitor analysis and **optional** AI generation, so teams consistently produce content that reflects the brand, satisfies search intent and gets cited by AI search.

It's organised around the 3Cs plus context: **Company** (brand), **Customers** (audience and search behaviour), **Competitors** (market) and **Context** (local market and search environment).

```
Brand understanding → Customer understanding → Competitor understanding → Search intelligence
      → Content strategy → Content creation → Quality validation → Feedback learning
```

## Two modes

| | **Free Intelligence** (default without OpenAI) | **AI Enhanced** |
|---|---|---|
| Engine | SerpApi + rules engine (`src/lib/intel`) | SerpApi + rules engine + OpenAI |
| Search analysis: intent, entities, SERP features, competitor angles, gaps | ✓ | ✓ |
| Customer questions (PAA, Reddit, forums), review themes, competitor intel | ✓ | ✓ plus written synthesis |
| Content briefs | ✓ template-based | ✓ refined outline + intro |
| SEO / GEO / brand-compliance / conversion checks | ✓ | ✓ |
| Rewrite and draft generation, rule extraction, ChatGPT visibility | – | ✓ |

Switch modes, choose the model (GPT-5.5 / GPT-5 / GPT-4.1 / custom) and optionally save a workspace API key under **Settings**. SerpApi is required in both modes.

## Features

- **Brand Intelligence**: company info, products, USPs, ✓ approved facts, ❌ restricted claims, and a voice profile (English variant, tone, sentence style, preferred and avoided vocabulary, CTA preference). Also site pages for internal links, competitors, local market settings, a **Brand Knowledge Score** with what's missing, and AI extraction from uploaded documents.
- **Brand Library**: upload PDF, DOCX, PPTX, XLSX, MD, TXT or CSV, or paste text. Content is indexed for retrieval (embeddings in AI mode, full-text search in free mode).
- **Feedback Intelligence**: log client and editor feedback. Rules and fact corrections are enforced by the checker (banned phrases) and followed by the AI writer. In AI mode you can paste an email thread and extract reusable rules.
- **Market Research**: Google SERP, People Also Ask, AI Overview, Maps and Maps reviews, Google Forums, Reddit, Tripadvisor places and reviews, and Booking snippets. Output: search intent, top entities, competitor angles, missing opportunities, customer questions (with frequency), positive and negative review themes, competitor strengths, weaknesses and opportunities, and recommendations.
- **SEO Opportunities**: Search Console CSV import, 3C classification with signals (striking distance, low CTR, question, local, competitor), a per-query **Search Opportunity Map** (✓ what competitors cover, ❌ what's missing, recommendation), and a content plan (rule-based or AI).
- **Content Briefs**: topic → intent, audience, customer questions, required entities, competitor angles, gaps, brand integration (approved facts, with MISSING flags), internal links, outline, titles, meta description and a GEO checklist. AI mode can generate the draft.
- **Optimise**: paste content and get scored on SEO (keyword placement, headings, depth, entity coverage vs. the live SERP, internal links), GEO ("Where should I stay?", "Why choose the brand?", "Best for families?", brand and location early, FAQ, quotable facts), brand compliance (restricted claims, banned words and feedback rules, brand and competitor spelling, figures not in approved facts, English variant) and conversion (CTA, preferred wording, booking links). Edit and re-check in free mode; AI rewrite fixes the failed checks.
- **AI Visibility** (AI mode): ChatGPT answers to query fan-outs compared with Google Maps and local pack rank.
- **Pipeline**: Planned → In Progress → Draft → Review → Complete → Published.

## Stack

Next.js 16 (App Router) · Supabase (Postgres + pgvector, Storage, Auth magic link) · OpenAI Responses API (structured outputs + web search) · SerpApi · Tailwind CSS 4. Deploys to Vercel.

## Try it locally in VS Code (no hosted Supabase needed)

Local Supabase runs in Docker, so you can see the full app before creating a real Supabase project.

**You need:** Node.js 20.9+ and [Docker Desktop](https://www.docker.com/products/docker-desktop/) running.

```bash
git clone https://github.com/khanh-spec/content-team-os.git
cd content-team-os
git checkout claude/seo-geo-brand-manager-beov9a
npm install

# 1. Start local Supabase (first run downloads images, takes a few minutes).
#    This also applies supabase/migrations/0001_init.sql automatically.
npm run db:start

# 2. Create your env file
cp .env.example .env.local
```

`npm run db:start` prints an **API URL** (`http://127.0.0.1:54321`) and a **Publishable key** (older CLI versions call it the *anon key*). Put them in `.env.local`, together with your OpenAI and SerpApi keys:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable / anon key from db:start>
ALLOWED_EMAIL_DOMAINS=
OPENAI_API_KEY=<your key>
SERPAPI_API_KEY=<your key>
```

```bash
# 3. Run the app
npm run dev
```

Open http://localhost:3000 and sign in with any email. Local Supabase doesn't send real emails: open **http://127.0.0.1:54324** (the local mail inbox), then click the sign-in link there.

Useful commands: `npm run db:status` (show URLs and keys again), `npm run db:reset` (wipe local data and re-apply migrations), and `npm run db:stop`.

## Deploy (hosted Supabase + Vercel)

1. **Supabase**
   - Create a project. In the SQL editor, run `supabase/migrations/0001_init.sql`, then `0002_brand_intelligence.sql`. They create the tables, search indexes, RLS policies and the private `brand-files` bucket.
   - Under Authentication → URL Configuration, set the Site URL to your Vercel URL and add `https://YOUR-DOMAIN/auth/callback` to the redirect URLs.
   - Recommended: disable open sign-ups or restrict them to your domain. The app also enforces `ALLOWED_EMAIL_DOMAINS`.
2. **Environment**: copy `.env.example` to `.env.local` and fill in the Supabase URL/key, `OPENAI_API_KEY` and `SERPAPI_API_KEY`.
3. **Run locally**
   ```bash
   npm install
   npm run dev
   ```
4. **Deploy to Vercel**: import the repo, add the same environment variables and deploy. The long-running routes (research, rewrite, visibility) set `maxDuration` of up to 300s. AI Visibility runs each ChatGPT sample as its own request from the browser, so no single function call runs long.

## Checks

```bash
npm run lint
npm run typecheck
npm test        # rules engine (real Adelaide SERP fixture), extraction, GSC, name matching, visibility scoring
npm run build
```

## Costs per action (approximate)

| Action | SerpApi searches | OpenAI calls |
|---|---|---|
| Local research (all sources) | 6–14 | 1 synthesis |
| AI visibility (5 prompts × 3 runs) | 2 | 15 web-search answers + 15 extractions + 2 |
| Content Studio rewrite | 0 | embeddings + 1 rewrite (+1 web-search fact-check if enabled) |
| Content plan | 0 | 1 |
