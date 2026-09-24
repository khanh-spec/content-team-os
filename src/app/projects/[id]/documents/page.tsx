import { DocumentList } from "@/components/documents";
import { SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { DocumentRow } from "@/lib/types";

export default async function DocumentsPage({ params }: PageProps<"/projects/[id]/documents">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, project_id, title, category, source, storage_path, mime_type, size_bytes, status, error, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false });
  return (
    <div>
      <SectionTitle
        title="Brand Library"
        description="Brand guidelines, fact sheets, tone references, writing samples and briefs. Everything here is indexed and searched on every rewrite."
      />
      <DocumentList projectId={id} documents={(data ?? []) as DocumentRow[]} />
    </div>
  );
}
