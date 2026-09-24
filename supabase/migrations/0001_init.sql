-- SEO/GEO Brand Manager — initial schema
-- Run in the Supabase SQL editor (or `supabase db push`).

create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Projects: one space per client / property. Holds the 3C brand profile.
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand_name text not null,
  brand_aliases text[] not null default '{}',
  website text,
  industry text not null default 'Hospitality',
  property_type text,                         -- hotel, resort, villa, restaurant, tour...
  city text,
  region text,
  country text,
  country_code text,                          -- ISO-2, e.g. vn (SerpApi gl)
  language text not null default 'en',        -- SerpApi hl
  serp_location text,                         -- SerpApi canonical location, e.g. "Hoi An, Quang Nam Province, Vietnam"
  latitude double precision,
  longitude double precision,
  -- Company
  brand_summary text,
  usps text,
  brand_facts text,                           -- canonical facts: room count, distances, awards, opening year...
  tone_of_voice text,
  words_to_use text,
  words_to_avoid text,
  -- Customers
  target_customers text,
  -- Competitors: [{ "name": "...", "website": "...", "aliases": ["..."] }]
  competitors jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Documents: brand guidelines, fact sheets, writing samples, requirements.
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  category text not null default 'other',     -- brand_guideline | fact_sheet | tone_reference | writing_sample | requirement | competitor | local_info | other
  source text not null default 'upload',      -- upload | paste
  storage_path text,
  mime_type text,
  size_bytes bigint,
  content_text text,
  status text not null default 'processing',  -- processing | ready | error
  error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists documents_project_idx on public.documents(project_id);

create table if not exists public.document_chunks (
  id bigserial primary key,
  document_id uuid not null references public.documents(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding extensions.vector(1536)
);
create index if not exists document_chunks_project_idx on public.document_chunks(project_id);
create index if not exists document_chunks_embedding_idx
  on public.document_chunks using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.match_document_chunks(
  p_project_id uuid,
  query_embedding extensions.vector(1536),
  match_count int default 8
)
returns table (id bigint, document_id uuid, title text, category text, content text, similarity float)
language sql stable
set search_path = public, extensions
as $$
  select c.id, c.document_id, d.title, d.category, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.project_id = p_project_id and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- ---------------------------------------------------------------------------
-- Feedback log: client / editor feedback. "rule" entries are injected into
-- every rewrite prompt so the writer learns from past corrections.
-- ---------------------------------------------------------------------------
create table if not exists public.feedback_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  draft_id uuid,
  source text not null default 'client',      -- client | internal | editor
  kind text not null default 'feedback',      -- feedback | rule | fact_correction
  content text not null,
  context text,                               -- the passage / page it refers to
  status text not null default 'open',        -- open | applied | archived
  apply_as_rule boolean not null default false,
  author_name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists feedback_project_idx on public.feedback_logs(project_id);

-- ---------------------------------------------------------------------------
-- Content drafts: pasted content + the brand-aware revision.
-- ---------------------------------------------------------------------------
create table if not exists public.content_drafts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  content_type text,                          -- blog | landing | room | faq | listicle | social | other
  target_keyword text,
  original_content text not null,
  revised_content text,
  analysis jsonb,                             -- fact checks, changes, tone notes, questions
  research_run_ids uuid[] not null default '{}',
  status text not null default 'draft',       -- draft | processing | reviewed | approved | error
  error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists drafts_project_idx on public.content_drafts(project_id);

alter table public.feedback_logs
  drop constraint if exists feedback_logs_draft_id_fkey,
  add constraint feedback_logs_draft_id_fkey foreign key (draft_id)
    references public.content_drafts(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Research runs: Local Context Research + AI visibility (ChatGPT vs SERP).
-- ---------------------------------------------------------------------------
create table if not exists public.research_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null,                         -- local_context | ai_visibility
  query text not null,
  params jsonb not null default '{}'::jsonb,
  status text not null default 'running',     -- running | done | error
  sources jsonb,                              -- raw-ish normalized source data
  summary jsonb,                              -- LLM synthesis / aggregated scores
  error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists research_project_idx on public.research_runs(project_id, kind);

create table if not exists public.visibility_samples (
  id bigserial primary key,
  run_id uuid not null references public.research_runs(id) on delete cascade,
  prompt_index int not null,
  iteration int not null,
  prompt text not null,
  answer text,
  mentions jsonb,                             -- [{name, position, sentiment, context}]
  citations jsonb,                            -- [{url, title, domain}]
  error text,
  created_at timestamptz not null default now(),
  unique (run_id, prompt_index, iteration)
);

-- ---------------------------------------------------------------------------
-- Search Console (layer 2). CSV import now, OAuth sync later.
-- ---------------------------------------------------------------------------
create table if not exists public.gsc_connections (
  project_id uuid primary key references public.projects(id) on delete cascade,
  site_url text,
  status text not null default 'not_connected', -- not_connected | connected | error
  last_synced_at timestamptz
);

-- OAuth tokens live in their own table with RLS on and NO policies, so only
-- the service role (server) can read them.
create table if not exists public.gsc_tokens (
  project_id uuid primary key references public.projects(id) on delete cascade,
  refresh_token_encrypted text not null,
  updated_at timestamptz not null default now()
);
alter table public.gsc_tokens enable row level security;

create table if not exists public.gsc_queries (
  id bigserial primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  query text not null,
  page text,
  clicks int not null default 0,
  impressions int not null default 0,
  ctr double precision,
  position double precision,
  period_label text,
  imported_at timestamptz not null default now()
);
create index if not exists gsc_queries_project_idx on public.gsc_queries(project_id);

create table if not exists public.opportunity_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  report jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
drop trigger if exists drafts_touch on public.content_drafts;
create trigger drafts_touch before update on public.content_drafts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security: internal team tool — any signed-in team member can
-- read/write every project. Sign-ups are restricted to allowed email domains
-- in the app (ALLOWED_EMAIL_DOMAINS) and should also be restricted in
-- Supabase Auth settings.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'projects','documents','document_chunks','feedback_logs','content_drafts',
    'research_runs','visibility_samples','gsc_connections','gsc_queries','opportunity_reports'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists team_all on public.%I', t);
    execute format(
      'create policy team_all on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage bucket for brand files
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('brand-files', 'brand-files', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "team read brand files" on storage.objects;
create policy "team read brand files" on storage.objects
  for select to authenticated using (bucket_id = 'brand-files');
drop policy if exists "team write brand files" on storage.objects;
create policy "team write brand files" on storage.objects
  for insert to authenticated with check (bucket_id = 'brand-files');
drop policy if exists "team delete brand files" on storage.objects;
create policy "team delete brand files" on storage.objects
  for delete to authenticated using (bucket_id = 'brand-files');
