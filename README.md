# SEO/GEO Brand Manager (Heads on Pillows)

A brand-specific writing workspace for hospitality SEO/GEO projects. Each client gets a **project space** that holds everything the writer needs to know about the **3Cs**:

| | What the tool stores | Where it comes from |
|---|---|---|
| **Company** | Official name + variants, verified brand facts, USPs, tone of voice, words to use/avoid, uploaded brand files | Brand Profile, Brand Library (PDF/DOCX/PPTX/XLSX/MD/TXT), Feedback rules |
| **Customers** | Target guests, real customer questions, review themes, guest vocabulary | Local Research (Google PAA, Maps reviews, Tripadvisor, Reddit, forums, Booking), Search Console |
| **Competitors** | Exact competitor names, their Maps/AI visibility, positioning | Brand Profile, AI Visibility (ChatGPT vs SerpApi), Local Research |

## Features

**Layer 1**

- **Project spaces**: one per client, with its own brand profile, documents, feedback, drafts and research.
- **Brand Library**: drag-and-drop upload (PDF, DOCX, PPTX, XLSX, MD, TXT, CSV) or pasted text. Files go to Supabase Storage, text is extracted, chunked and embedded (pgvector) so rewrites retrieve the relevant passages.
- **Feedback Log**: client, internal and editor feedback with status (open/applied/archived). Feedback marked *writing rule* or *fact correction* is injected into every future rewrite, so the writer learns from past corrections.
- **Content Studio**: paste existing content and get back:
  - a revised version in the brand's tone with natural wording
  - a fact-check list covering wrong brand facts, misspelled brand/competitor names and wrong local facts, each with its source
  - brand facts added, key edits, questions for the client, and SEO/GEO notes
  - optional **live web fact-check** (OpenAI web search) before rewriting
  - word-level diff, inline editing, approve, re-run, and feedback per draft
- **Local Context Research** (SerpApi): Google SERP + People Also Ask + AI Overview, Google Maps, Google Maps reviews (brand + 2 competitors), Google Forums, Reddit, Tripadvisor places + reviews, Booking.com snippets. These are synthesized into customer questions, review themes, guest vocabulary, local facts, brand perception, competitor insights and content angles.
- **AI Visibility** (ChatGPT vs SerpApi Local/Maps): generates query fan-outs from a seed and runs each prompt N times through the OpenAI Responses API with web search forced on and the destination as user location. It then extracts every business mentioned and compares mention rate, answer position and citations with Google Maps rank and local pack rank. Each business is tagged *AI + Maps*, *AI only* or *Maps only (AI gap)*, and the check ends with recommendations. The approach follows the DataForSEO Danang restaurant study, which compared the local business pack against text citations.

**Layer 2: Opportunities**

- Import a Search Console **Queries CSV** (OAuth sync is stubbed for phase 2; the data model is ready).
- Every query is classified into a 3C pillar and tagged with signals: branded, competitor name, comparison intent, question, local modifier, striking distance (positions 4–20), low CTR for position, and content gap. Each query is also marked short or long tail and scored by estimated extra clicks.
- **Build content plan** turns GSC data, local research and AI visibility into grouped briefs. Each brief gives the action, primary and supporting queries, questions to answer, brand facts to use (flagging *MISSING* facts to request from the client), the competitor angle and a GEO note. Any brief opens in Content Studio with the brief pre-filled.

### Why Layer 2 is built around the 3Cs

The goal is a brand-specific writer, not another keyword tool, so Search Console is used to decide what the writer should say next:

1. **Company queries → fact coverage.** Branded queries such as "anio hotel parking" or "anio hotel rooftop pool" show which facts people look for. If the answer isn't in the brand facts, the plan lists it as a missing fact to request. AI assistants can only repeat facts that are published explicitly.
2. **Customer queries → answer the real question.** Long-tail questions and local-intent queries ("where to stay in hoi an with kids", "near the night market") are matched with PAA, Reddit and review questions from Local Research. The brief then says which questions to answer, in the guests' own vocabulary.
3. **Competitor queries → provable differentiation.** Competitor-name and "vs" queries, combined with AI visibility data (who ChatGPT recommends instead, and which domains it cites), become comparison or positioning content that only claims what the brand can prove.
4. **Close the loop.** When a published draft gets client feedback, log it and it becomes a rule. Re-run AI Visibility after publishing to see whether the brand's mention rate moved.

Suggested next steps: GSC OAuth with a daily sync and per-page drill-down; scheduled AI visibility re-checks with trend charts; one-click on-page brand-fact audits of URLs; an entity/schema (JSON-LD) generator from the brand facts.

## Stack

Next.js 16 (App Router) · Supabase (Postgres + pgvector, Storage, Auth magic link) · OpenAI Responses API (structured outputs + web search) · SerpApi · Tailwind CSS 4. Deploys to Vercel.

## Setup

1. **Supabase**
   - Create a project. In the SQL editor, run `supabase/migrations/0001_init.sql`. It creates the tables, the pgvector index, RLS policies and the private `brand-files` bucket.
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
npm test        # extraction, GSC parsing/classification, name matching, visibility scoring
npm run build
```

## Costs per action (approximate)

| Action | SerpApi searches | OpenAI calls |
|---|---|---|
| Local research (all sources) | 6–14 | 1 synthesis |
| AI visibility (5 prompts × 3 runs) | 2 | 15 web-search answers + 15 extractions + 2 |
| Content Studio rewrite | 0 | embeddings + 1 rewrite (+1 web-search fact-check if enabled) |
| Content plan | 0 | 1 |
