import { NextResponse } from "next/server";
import { HttpError, handle, must, requireUser } from "@/lib/api";

type Ctx = RouteContext<"/api/projects/[id]/documents/[docId]">;

/** Redirect to a short-lived signed download URL for the original file. */
export const GET = handle<Ctx>(async (_req, ctx) => {
  const { id, docId } = await ctx.params;
  const { supabase } = await requireUser();
  const doc = must(
    await supabase.from("documents").select("storage_path").eq("id", docId).eq("project_id", id).single(),
  );
  if (!doc.storage_path) throw new HttpError(404, "This document was pasted, not uploaded");
  const { data, error } = await supabase.storage.from("brand-files").createSignedUrl(doc.storage_path, 60);
  if (error || !data) throw new HttpError(500, error?.message ?? "Could not sign URL");
  return NextResponse.redirect(data.signedUrl);
});

export const DELETE = handle<Ctx>(async (_req, ctx) => {
  const { id, docId } = await ctx.params;
  const { supabase } = await requireUser();
  const doc = must(
    await supabase.from("documents").select("storage_path").eq("id", docId).eq("project_id", id).single(),
  );
  if (doc.storage_path) await supabase.storage.from("brand-files").remove([doc.storage_path]);
  const { error } = await supabase.from("documents").delete().eq("id", docId);
  if (error) throw new Error(error.message);
  return { ok: true };
});
