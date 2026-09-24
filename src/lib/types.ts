export type Competitor = { name: string; website?: string; aliases?: string[] };

export type Project = {
  id: string;
  name: string;
  brand_name: string;
  brand_aliases: string[];
  website: string | null;
  industry: string;
  property_type: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
  language: string;
  serp_location: string | null;
  latitude: number | null;
  longitude: number | null;
  brand_summary: string | null;
  usps: string | null;
  brand_facts: string | null;
  tone_of_voice: string | null;
  words_to_use: string | null;
  words_to_avoid: string | null;
  target_customers: string | null;
  competitors: Competitor[];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const DOCUMENT_CATEGORIES = [
  { value: "brand_guideline", label: "Brand guideline" },
  { value: "fact_sheet", label: "Fact sheet" },
  { value: "tone_reference", label: "Tone of voice reference" },
  { value: "writing_sample", label: "Writing sample" },
  { value: "requirement", label: "Project requirement / brief" },
  { value: "competitor", label: "Competitor info" },
  { value: "local_info", label: "Local area info" },
  { value: "other", label: "Other" },
] as const;

export type DocumentRow = {
  id: string;
  project_id: string;
  title: string;
  category: string;
  source: "upload" | "paste";
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  content_text: string | null;
  status: "processing" | "ready" | "error";
  error: string | null;
  created_at: string;
};

export type FeedbackRow = {
  id: string;
  project_id: string;
  draft_id: string | null;
  source: "client" | "internal" | "editor";
  kind: "feedback" | "rule" | "fact_correction";
  content: string;
  context: string | null;
  status: "open" | "applied" | "archived";
  apply_as_rule: boolean;
  author_name: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type FactCheck = {
  original: string;
  issue: string;
  correction: string;
  type: "brand_fact" | "competitor_name" | "brand_name" | "local_fact" | "unverifiable" | "other";
  severity: "high" | "medium" | "low";
  evidence: string;
};

export type DraftAnalysis = {
  summary: string;
  fact_checks: FactCheck[];
  changes: { before: string; after: string; reason: string }[];
  added_facts: { fact: string; source: string }[];
  tone_notes: string[];
  questions_for_client: string[];
  seo_geo_notes: string[];
  context_used?: { documents: string[]; research: string[]; rules: number };
};

export type DraftRow = {
  id: string;
  project_id: string;
  title: string;
  content_type: string | null;
  target_keyword: string | null;
  original_content: string;
  revised_content: string | null;
  analysis: DraftAnalysis | null;
  research_run_ids: string[];
  status: "draft" | "processing" | "reviewed" | "approved" | "error";
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type ResearchRun<S = unknown, Src = unknown> = {
  id: string;
  project_id: string;
  kind: "local_context" | "ai_visibility";
  query: string;
  params: Record<string, unknown>;
  status: "running" | "done" | "error";
  sources: Src | null;
  summary: S | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};
