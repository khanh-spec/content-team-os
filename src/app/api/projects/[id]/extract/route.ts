import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { requireAI } from "@/lib/ai";
import { HttpError, handle, requireUser } from "@/lib/api";
import { brandProfile, loadProject } from "@/lib/context";

export const maxDuration = 120;

type Ctx = RouteContext<"/api/projects/[id]/extract">;

const field = (d: string) => z.string().describe(`${d} Use one item per line. Empty string if the documents don't say.`);
const Extraction = z.object({
  brand_summary: z.string().describe("2–3 sentence summary of the brand. Empty string if unknown."),
  products: field("Products and services (rooms, restaurants, spa, events…)."),
  usps: field("Unique selling points, stated factually."),
  brand_facts: field("Verifiable facts: counts, addresses, distances, opening hours, awards, amenities."),
  restricted_claims: field("Claims the brand must not make, phrased as 'Cannot claim …'. Include anything the documents say is unavailable or forbidden."),
  tone_of_voice: z.string().describe("Short tone description, e.g. 'Premium but approachable'. Empty string if unknown."),
  sentence_style: z.string().describe("Sentence style guidance. Empty string if unknown."),
  words_to_use: field("Preferred words and phrases."),
  words_to_avoid: field("Words and phrases to avoid."),
  cta_preference: z.string().describe("Preferred call to action wording. Empty string if unknown."),
  target_customers: field("Audience segments."),
});

/** AI mode: read the Brand Library and propose profile fields. */
export const POST = handle<Ctx>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const { supabase } = await requireUser();
  const ai = await requireAI(supabase);
  const project = await loadProject(supabase, id);
  const { data: docs } = await supabase.from("documents").select("title, category, content_text").eq("project_id", id).eq("status", "ready").order("created_at", { ascending: false }).limit(20);
  let budget = 90_000;
  const corpus = (docs ?? [])
    .filter((d) => d.content_text)
    .map((d) => {
      const text = String(d.content_text).slice(0, Math.max(0, Math.min(25_000, budget)));
      budget -= text.length;
      return text ? `## ${d.title} (${d.category})\n${text}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
  if (!corpus) throw new HttpError(400, "Upload brand documents to the Brand Library first.");

  const res = await ai.client.responses.parse({
    model: ai.model,
    instructions:
      "Extract a hospitality brand's knowledge base from its documents. Only include what the documents state; never invent facts. " +
      "Don't repeat items already in the current profile. Keep each line short and specific.",
    input: `# Current profile\n${brandProfile(project)}\n\n# Documents\n${corpus}`,
    text: { format: zodTextFormat(Extraction, "brand_extraction") },
  });
  if (!res.output_parsed) throw new HttpError(502, "The model returned nothing");
  return { suggestions: res.output_parsed };
});
