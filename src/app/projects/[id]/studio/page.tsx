import Link from "next/link";
import { NewDraftForm } from "@/components/studio";
import { Badge, Card, SectionTitle, formatDate } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export default async function StudioPage({ params, searchParams }: PageProps<"/projects/[id]/studio">) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: drafts }, { data: runs }] = await Promise.all([
    supabase.from("content_drafts").select("id, title, content_type, target_keyword, status, updated_at").eq("project_id", id).order("updated_at", { ascending: false }),
    supabase.from("research_runs").select("id, kind, query, created_at").eq("project_id", id).eq("status", "done").order("created_at", { ascending: false }).limit(20),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <SectionTitle
          title="Content Studio"
          description="Paste content you've already written. The brand writer fact-checks it against the brand library, feedback rules and research, then returns a revised version in the brand's voice."
        />
        <NewDraftForm
          projectId={id}
          runs={runs ?? []}
          initial={{
            title: typeof sp.title === "string" ? sp.title : "",
            target_keyword: typeof sp.keyword === "string" ? sp.keyword : "",
            instructions: typeof sp.brief === "string" ? sp.brief : "",
          }}
        />
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Drafts</h3>
        {drafts?.length ? (
          <Card className="divide-y divide-ink-100 p-0">
            {drafts.map((d) => (
              <Link key={d.id} href={`/projects/${id}/studio/${d.id}`} className="block px-4 py-3 hover:bg-ink-50">
                <p className="font-medium">{d.title}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-ink-500">
                  <Badge tone={d.status === "approved" ? "green" : d.status === "error" ? "red" : d.status === "processing" ? "amber" : "gray"}>{d.status}</Badge>
                  {d.content_type && <span>{d.content_type}</span>}
                  <span>{formatDate(d.updated_at)}</span>
                </p>
              </Link>
            ))}
          </Card>
        ) : (
          <p className="text-sm text-ink-500">No drafts yet.</p>
        )}
      </div>
    </div>
  );
}
