import "server-only";

import type { Supabase } from "@/lib/api";
import { HttpError } from "@/lib/api";
import { chunkText } from "@/lib/extract";
import { embed } from "@/lib/openai";
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

/**
 * Retrieve the most relevant passages from the project's documents for the
 * given text. Several queries (e.g. per paragraph) are merged and de-duplicated.
 */
export async function retrieve(
  supabase: Supabase,
  projectId: string,
  queries: string[],
  perQuery = 6,
  maxTotal = 14,
): Promise<RetrievedChunk[]> {
  const qs = queries.map((q) => q.trim()).filter(Boolean).slice(0, 8);
  if (!qs.length) return [];
  const vectors = await embed(qs);
  const seen = new Map<string, RetrievedChunk>();
  for (const v of vectors) {
    const { data, error } = await supabase.rpc("match_document_chunks", {
      p_project_id: projectId,
      query_embedding: v as unknown as string,
      match_count: perQuery,
    });
    if (error) throw new Error(`Retrieval failed: ${error.message}`);
    for (const row of (data ?? []) as (RetrievedChunk & { id: number })[]) {
      const key = String(row.id);
      const prev = seen.get(key);
      if (!prev || prev.similarity < row.similarity) seen.set(key, row);
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
export async function indexDocument(supabase: Supabase, doc: { id: string; project_id: string }, text: string) {
  await supabase.from("document_chunks").delete().eq("document_id", doc.id);
  const chunks = chunkText(text);
  if (chunks.length) {
    const vectors = await embed(chunks);
    const rows = chunks.map((content, i) => ({
      document_id: doc.id,
      project_id: doc.project_id,
      chunk_index: i,
      content,
      embedding: vectors[i] as unknown as string,
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
