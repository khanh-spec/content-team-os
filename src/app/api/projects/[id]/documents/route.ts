import { z } from "zod";
import { HttpError, handle, must, parseBody, requireUser } from "@/lib/api";
import { getAI } from "@/lib/ai";
import { indexDocument } from "@/lib/context";
import { extractText } from "@/lib/extract";

export const maxDuration = 300;

type Ctx = RouteContext<"/api/projects/[id]/documents">;

const Body = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("paste"),
    title: z.string().trim().min(1),
    category: z.string().default("other"),
    text: z.string().min(1).max(500_000),
  }),
  z.object({
    mode: z.literal("upload"),
    title: z.string().trim().min(1),
    category: z.string().default("other"),
    storage_path: z.string().min(1),
    filename: z.string().min(1),
    mime_type: z.string().nullish(),
    size_bytes: z.number().nullish(),
  }),
]);

export const POST = handle<Ctx>(async (req, ctx) => {
  const { id: projectId } = await ctx.params;
  const { supabase, user } = await requireUser();
  const body = await parseBody(req, Body);

  if (body.mode === "upload" && !body.storage_path.startsWith(`${projectId}/`)) {
    throw new HttpError(400, "File must be stored under the project folder");
  }

  const doc = must(
    await supabase
      .from("documents")
      .insert({
        project_id: projectId,
        title: body.title,
        category: body.category,
        source: body.mode,
        storage_path: body.mode === "upload" ? body.storage_path : null,
        mime_type: body.mode === "upload" ? body.mime_type : "text/markdown",
        size_bytes: body.mode === "upload" ? body.size_bytes : body.text.length,
        created_by: user.id,
      })
      .select("id, project_id")
      .single(),
  );

  try {
    let text: string;
    if (body.mode === "paste") {
      text = body.text.trim();
    } else {
      const { data: blob, error } = await supabase.storage.from("brand-files").download(body.storage_path);
      if (error || !blob) throw new Error(`Could not read uploaded file: ${error?.message ?? "missing"}`);
      text = await extractText(Buffer.from(await blob.arrayBuffer()), body.filename, body.mime_type);
    }
    if (!text) throw new Error("No readable text found in this file (scanned PDFs need OCR first).");
    const chunks = await indexDocument(supabase, await getAI(supabase), doc, text);
    return { id: doc.id, chunks };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("documents").update({ status: "error", error: message }).eq("id", doc.id);
    throw new HttpError(422, message);
  }
});
