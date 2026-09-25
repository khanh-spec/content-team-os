import "server-only";

import type { Supabase } from "@/lib/api";
import { HttpError } from "@/lib/api";
import { chunkText } from "@/lib/extract";
import { embed, type AI } from "@/lib/ai";
import type { FeedbackRow, Project } from "@/lib/types";

export async function loadProject(supabase: Supabase, id: string): Promise<Project> {
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
  if (error || !data) throw new HttpError(404, "Project not found");
  return data as Project;
}

/** The 3C brand profile as a prompt block. */
export function brandProfile(p: Project): string {
  const competitors = (p.competitors ?? [])
    .map((c) => `- ${c.name}${c.website ? ` (${c.website})` : ""}${c.aliases?.length ? ` — also written: ${c.aliases.join(", ")}` : ""}`)
    .join("\n");
  const section = (title: string, body?: string | null) => (body?.trim() ? `### ${title}\n${body.trim()}\n` : "");
  return [
    `## COMPANY — ${p.brand_name}`,
    `Official brand name: "${p.brand_name}"${p.brand_aliases?.length ? `. Accepted variants: ${p.brand_aliases.map((a) => `"${a}"`).join(", ")}` : ""}`,
    `Industry: ${p.industry}${p.property_type ? ` / ${p.property_type}` : ""}`,
    `Location: ${[p.city, p.region, p.country].filter(Boolean).join(", ") || "not set"}`,
    p.website ? `Website: ${p.website}` : "",
    section("Brand summary", p.brand_summary),
    section("USPs", p.usps),
    section("Verified brand facts (source of truth)", p.brand_facts),
    section("Tone of voice", p.tone_of_voice),
    section("Words / phrases to use", p.words_to_use),
    section("Words / phrases to avoid", p.words_to_avoid),
    `## CUSTOMERS`,
    p.target_customers?.trim() || "Not specified.",
    `## COMPETITORS (use exact spelling)`,
    competitors || "None listed.",
    section("Other notes", p.notes),
  ]
    .filter(Boolean)
    .join("\n");
}

export async function loadRules(supabase: Supabase, projectId: string): Promise<FeedbackRow[]> {
  const { data } = await supabase
    .from("feedback_logs")
    .select("*")
    .eq("project_id", projectId)
    .neq("status", "archived")
    .or("apply_as_rule.eq.true,kind.eq.rule,kind.eq.fact_correction")
    .order("created_at", { ascending: false })
    .limit(60);
  return (data ?? []) as FeedbackRow[];
}

export function rulesBlock(rules: FeedbackRow[]): string {
  if (!rules.length) return "No logged feedback rules yet.";
  return rules
    .map((r) => `- [${r.kind === "fact_correction" ? "FACT" : "RULE"} · ${r.source}] ${r.content}${r.context ? ` (re: "${r.context.slice(0, 160)}")` : ""}`)
    .join("\n");
}

export type RetrievedChunk = { document_id: string; title: string; category: string; content: string; similarity: number };

const STOP = new Set("the a an and or of to in on for with at by from is are was were be this that it as our your we you they their its".split(" "));

/** OR-joined tsquery of the distinctive words in the queries (free-mode fallback). */
function toTsQuery(queries: string[]) {
  const words = queries
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9]{3,}/g) ?? [];
  return [...new Set(words.filter((w) => !STOP.has(w)))].slice(0, 30).join(" | ");
}

/**
 * Retrieve the most relevant passages from the project's documents. Uses
 * embeddings in AI mode and Postgres full-text search in free mode (or for
 * documents indexed without embeddings).
 */
export async function retrieve(
  supabase: Supabase,
  ai: AI | null,
  projectId: string,
  queries: string[],
  perQuery = 6,
  maxTotal = 14,
): Promise<RetrievedChunk[]> {
  const qs = queries.map((q) => q.trim()).filter(Boolean).slice(0, 8);
  if (!qs.length) return [];
  const seen = new Map<string, RetrievedChunk>();
  const add = (rows: (RetrievedChunk & { id: number })[]) => {
    for (const row of rows) {
      const key = String(row.id);
      const prev = seen.get(key);
      if (!prev || prev.similarity < row.similarity) seen.set(key, row);
    }
  };

  if (ai) {
    const vectors = await embed(ai, qs);
    for (const v of vectors) {
      const { data, error } = await supabase.rpc("match_document_chunks", {
        p_project_id: projectId,
        query_embedding: v as unknown as string,
        match_count: perQuery,
      });
      if (error) throw new Error(`Retrieval failed: ${error.message}`);
      add((data ?? []) as (RetrievedChunk & { id: number })[]);
    }
  }
  if (seen.size < maxTotal / 2) {
    const q = toTsQuery(qs);
    if (q) {
      const { data } = await supabase.rpc("search_document_chunks", { p_project_id: projectId, q, match_count: maxTotal });
      add(((data ?? []) as (RetrievedChunk & { id: number })[]).map((r) => ({ ...r, similarity: Math.min(0.5, r.similarity) })));
    }
  }
  return [...seen.values()].sort((a, b) => b.similarity - a.similarity).slice(0, maxTotal);
}

export function chunksBlock(chunks: RetrievedChunk[]): string {
  if (!chunks.length) return "No uploaded brand documents matched.";
  return chunks
    .map((c, i) => `[D${i + 1}] ${c.title} (${c.category})\n${c.content}`)
    .join("\n\n---\n\n");
}

/** Chunk + embed a document's text and mark it ready. */
export async function indexDocument(supabase: Supabase, ai: AI | null, doc: { id: string; project_id: string }, text: string) {
  await supabase.from("document_chunks").delete().eq("document_id", doc.id);
  const chunks = chunkText(text);
  if (chunks.length) {
    // Embeddings only in AI mode; free mode relies on full-text search.
    const vectors = ai ? await embed(ai, chunks).catch(() => null) : null;
    const rows = chunks.map((content, i) => ({
      document_id: doc.id,
      project_id: doc.project_id,
      chunk_index: i,
      content,
      embedding: (vectors?.[i] ?? null) as unknown as string,
    }));
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabase.from("document_chunks").insert(rows.slice(i, i + 100));
      if (error) throw new Error(error.message);
    }
  }
  const { error } = await supabase
    .from("documents")
    .update({ content_text: text, status: "ready", error: null })
    .eq("id", doc.id);
  if (error) throw new Error(error.message);
  return chunks.length;
}
