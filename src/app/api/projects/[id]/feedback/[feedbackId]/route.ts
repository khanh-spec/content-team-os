import { z } from "zod";
import { handle, parseBody, requireUser } from "@/lib/api";

type Ctx = RouteContext<"/api/projects/[id]/feedback/[feedbackId]">;

const Patch = z.object({
  status: z.enum(["open", "applied", "archived"]).optional(),
  apply_as_rule: z.boolean().optional(),
  kind: z.enum(["feedback", "rule", "fact_correction"]).optional(),
  content: z.string().trim().min(1).optional(),
});

export const PATCH = handle<Ctx>(async (req, ctx) => {
  const { id, feedbackId } = await ctx.params;
  const { supabase } = await requireUser();
  const input = await parseBody(req, Patch);
  const resolved_at = input.status && input.status !== "open" ? new Date().toISOString() : input.status === "open" ? null : undefined;
  const { error } = await supabase
    .from("feedback_logs")
    .update({ ...input, ...(resolved_at !== undefined ? { resolved_at } : {}) })
    .eq("id", feedbackId)
    .eq("project_id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
});

export const DELETE = handle<Ctx>(async (_req, ctx) => {
  const { id, feedbackId } = await ctx.params;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("feedback_logs").delete().eq("id", feedbackId).eq("project_id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
});
