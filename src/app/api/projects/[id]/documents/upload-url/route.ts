import { z } from "zod";
import { HttpError, handle, parseBody, requireUser } from "@/lib/api";

type Ctx = RouteContext<"/api/projects/[id]/documents/upload-url">;

const Body = z.object({ filename: z.string().trim().min(1).max(300) });

/**
 * Returns a one-time signed URL the browser uploads the file to. The URL is
 * scoped to one path in the private brand-files bucket, so no Supabase key is
 * sent to the browser.
 */
export const POST = handle<Ctx>(async (req, ctx) => {
  const { id: projectId } = await ctx.params;
  const { supabase } = await requireUser();
  const { filename } = await parseBody(req, Body);
  const safe = filename.replace(/[^\w.\-]+/g, "_");
  const path = `${projectId}/${crypto.randomUUID()}-${safe}`;
  const { data, error } = await supabase.storage.from("brand-files").createSignedUploadUrl(path);
  if (error || !data) throw new HttpError(400, error?.message ?? "Could not prepare upload");
  return { path, signedUrl: data.signedUrl };
});
