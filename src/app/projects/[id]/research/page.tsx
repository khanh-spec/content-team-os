import Link from "next/link";
import { ResearchWorkspace } from "@/components/research";
import { Badge, Card, Empty, SectionTitle, formatDate } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { LOCAL_SOURCES } from "@/lib/research/local";

export default async function ResearchPage({ params }: PageProps<"/projects/[id]/research">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: runs }, { data: project }] = await Promise.all([
    supabase.from("research_runs").select("id, query, status, error, created_at, params").eq("project_id", id).eq("kind", "local_context").order("created_at", { ascending: false }),
    supabase.from("projects").select("city, country, serp_location").eq("id", id).single(),
  ]);

  return (
    <div>
      <SectionTitle
        title="Market Research"
        description="Search intent, entities, competitor angles, customer questions and review themes for any topic, from Google, Maps, Reddit, forums, Tripadvisor and Booking. Works in Free mode; AI mode adds a written synthesis."
      />
      <ResearchWorkspace projectId={id} sources={LOCAL_SOURCES.map((s) => ({ id: s.id, label: s.label }))} location={project?.serp_location || [project?.city, project?.country].filter(Boolean).join(", ")}>
        <h3 className="mb-3 mt-1 text-sm font-semibold uppercase tracking-wide text-ink-500">Research runs</h3>
        {runs?.length ? (
          <Card className="divide-y divide-ink-100 p-0">
            {runs.map((r) => (
              <Link key={r.id} href={`/projects/${id}/research/${r.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-ink-50">
                <div>
                  <p className="font-medium">{r.query}</p>
                  <p className="text-xs text-ink-500">{(r.params as { sources?: string[] })?.sources?.length ?? 0} sources · {formatDate(r.created_at)}</p>
                </div>
                <Badge tone={r.status === "done" ? "green" : r.status === "error" ? "red" : "amber"}>{r.status}</Badge>
              </Link>
            ))}
          </Card>
        ) : (
          <Empty title="No research yet">Try a topic like “romantic things to do in Hoi An” or “where to stay in Hoi An with kids”.</Empty>
        )}
      </ResearchWorkspace>
    </div>
  );
}
