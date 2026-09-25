import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefView } from "@/components/brief-view";
import { getAI } from "@/lib/ai";
import type { ContentBrief } from "@/lib/intel/brief";
import { createClient } from "@/lib/supabase/server";

export default async function BriefPage({ params }: PageProps<"/projects/[id]/briefs/[briefId]">) {
  const { id, briefId } = await params;
  const supabase = await createClient();
  const [{ data }, ai] = await Promise.all([supabase.from("content_briefs").select("brief").eq("id", briefId).eq("project_id", id).maybeSingle(), getAI(supabase)]);
  if (!data) notFound();
  return (
    <div className="space-y-4">
      <Link href={`/projects/${id}/briefs`} className="text-sm text-ink-500 hover:text-ink-800">
        ← Content briefs
      </Link>
      <BriefView projectId={id} brief={data.brief as ContentBrief} aiEnabled={!!ai} />
    </div>
  );
}
