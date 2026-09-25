-- Brand Intelligence Manager: free/AI modes, brand rules, briefs, optimisation.

-- Brand profile additions -----------------------------------------------------
alter table public.projects
  add column if not exists products text,              -- rooms, restaurants, spa…
  add column if not exists restricted_claims text,     -- one per line: claims the brand must never make
  add column if not exists english_variant text not null default 'British English',
  add column if not exists sentence_style text,
  add column if not exists cta_preference text,
  add column if not exists site_pages jsonb not null default '[]'::jsonb; -- [{title,url,type}] for internal links

-- Workspace settings (single row) ---------------------------------------------
create table if not exists public.workspace_settings (
  id int primary key default 1 check (id = 1),
  ai_enabled boolean not null default true,
  openai_model text not null default 'gpt-5.5',
  updated_at timestamptz not null default now()
);
insert into public.workspace_settings (id) values (1) on conflict (id) do nothing;

-- The optional OpenAI key lives in its own table with RLS on and no policies,
-- so only the server (service role) can read it.
create table if not exists public.workspace_secrets (
  id int primary key default 1 check (id = 1),
  openai_key_encrypted text,
  updated_at timestamptz not null default now()
);
alter table public.workspace_secrets enable row level security;

-- Content briefs ---------------------------------------------------------------
create table if not exists public.content_briefs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  topic text not null,
  mode text not null default 'free',                   -- free | ai
  brief jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists briefs_project_idx on public.content_briefs(project_id);

-- Rule-based optimisation report stored alongside AI analysis ------------------
alter table public.content_drafts add column if not exists optimisation jsonb;

-- Full-text search fallback for documents when embeddings are unavailable -------
alter table public.document_chunks
  add column if not exists fts tsvector generated always as (to_tsvector('simple', content)) stored;
create index if not exists document_chunks_fts_idx on public.document_chunks using gin (fts);

-- q is an OR-joined tsquery built by the app, e.g. 'pool | breakfast'
create or replace function public.search_document_chunks(p_project_id uuid, q text, match_count int default 8)
returns table (id bigint, document_id uuid, title text, category text, content text, similarity float)
language sql stable
set search_path = public
as $$
  select c.id, c.document_id, d.title, d.category, c.content,
         ts_rank(c.fts, to_tsquery('simple', q))::float as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.project_id = p_project_id and c.fts @@ to_tsquery('simple', q)
  order by similarity desc
  limit match_count;
$$;

-- RLS for new team tables -------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['workspace_settings','content_briefs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists team_all on public.%I', t);
    execute format('create policy team_all on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
