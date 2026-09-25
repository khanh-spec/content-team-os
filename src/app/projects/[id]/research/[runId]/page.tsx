import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteRun } from "@/components/delete-run";
import { ResearchReport, type StoredResearch } from "@/components/research-report";
import { ButtonLink, formatDate } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { LocalSources } from "@/lib/research/local";
import type { ResearchRun } from "@/lib/types";

export default async function ResearchRunPage({ params }: PageProps<"/projects/[id]/research/[runId]">) {
  const { id, runId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("research_runs").select("*").eq("id", runId).eq("project_id", id).maybeSingle();
  if (!data) notFound();
  const run = data as ResearchRun<StoredResearch, LocalSources>;
  const src = run.sources;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/projects/${id}/research`} className="text-sm text-ink-500 hover:text-ink-800">
            ← Market research
          </Link>
          <h2 className="mt-1 text-xl font-semibold">{run.query}</h2>
          <p className="text-sm text-ink-500">
            {formatDate(run.created_at)} {src && `· ${src.serpapiCalls} SerpApi searches · searched as “${src.query}”`}
          </p>
        </div>
        <div className="flex gap-2">
          {run.summary && (
            <ButtonLink href={`/projects/${id}/briefs?topic=${encodeURIComponent(run.query)}`} variant="secondary">
              Create brief
            </ButtonLink>
          )}
          <DeleteRun projectId={id} runId={run.id} back={`/projects/${id}/research`} />
        </div>
      </div>
      {run.status === "error" && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{run.error}</p>}
      {run.status === "running" && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">Still running or interrupted. Refresh in a moment.</p>}
      <ResearchReport projectId={id} summary={run.summary} src={src} />
    </div>
  );
}
