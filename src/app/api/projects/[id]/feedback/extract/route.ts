import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { requireAI } from "@/lib/ai";
import { HttpError, handle, parseBody, requireUser } from "@/lib/api";
import { brandProfile, loadProject, loadRules, rulesBlock } from "@/lib/context";

export const maxDuration = 90;

type Ctx = RouteContext<"/api/projects/[id]/feedback/extract">;

const Body = z.object({ text: z.string().trim().min(10).max(40_000) });
const Rules = z.object({
  rules: z.array(
    z.object({
      rule: z.string().describe("A reusable instruction for all future content, e.g. 'Only mention external businesses when needed for destination context.'"),
      kind: z.enum(["rule", "fact_correction"]),
      category: z.enum(["tone", "facts", "competitors", "structure", "vocabulary", "claims", "cta", "other"]),
      source_quote: z.string().describe("The part of the feedback this comes from"),
    }),
  ),
});

/** AI mode: turn raw client feedback (emails, comments) into reusable brand rules. */
export const POST = handle<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  const { supabase } = await requireUser();
  const ai = await requireAI(supabase);
  const { text } = await parseBody(req, Body);
  const [project, existing] = await Promise.all([loadProject(supabase, id), loadRules(supabase, id)]);
  const res = await ai.client.responses.parse({
    model: ai.model,
    instructions:
      "You turn client feedback on hospitality content into reusable brand rules. Generalise one-off comments into rules that apply to future drafts " +
      "(e.g. 'Do not promote competitors' → 'Only mention external businesses when required for destination context. Keep the brand as the main solution.'). " +
      "Corrections of facts become 'fact_correction'. Skip anything already covered by existing rules. Return an empty list if nothing is reusable.",
    input: `# Brand\n${brandProfile(project)}\n\n# Existing rules\n${rulesBlock(existing)}\n\n# New feedback\n${text}`,
    text: { format: zodTextFormat(Rules, "feedback_rules") },
  });
  if (!res.output_parsed) throw new HttpError(502, "The model returned nothing");
  return res.output_parsed;
});
