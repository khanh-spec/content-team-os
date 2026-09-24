import { z } from "zod";
import { HttpError, handle, parseBody, requireUser } from "@/lib/api";
import { parseGscCsv } from "@/lib/gsc/opportunities";

export const maxDuration = 60;

type Ctx = RouteContext<"/api/projects/[id]/gsc">;

const Body = z.object({
  csv: z.string().min(10).max(5_000_000),
  period_label: z.string().trim().max(100).nullish(),
  replace: z.boolean().default(true),
});

/** Import a Search Console performance export (Queries or Queries+Pages CSV). */
export const POST = handle<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  const { supabase } = await requireUser();
  const { csv, period_label, replace } = await parseBody(req, Body);
  let rows;
  try {
    rows = parseGscCsv(csv);
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "Could not parse CSV");
  }
  if (!rows.length) throw new HttpError(400, "No query rows found in the CSV");

  if (replace) await supabase.from("gsc_queries").delete().eq("project_id", id);
  const records = rows.map((r) => ({ ...r, project_id: id, period_label: period_label || null }));
  for (let i = 0; i < records.length; i += 500) {
    const { error } = await supabase.from("gsc_queries").insert(records.slice(i, i + 500));
    if (error) throw new Error(error.message);
  }
  return { imported: records.length };
});

export const DELETE = handle<Ctx>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("gsc_queries").delete().eq("project_id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
});
