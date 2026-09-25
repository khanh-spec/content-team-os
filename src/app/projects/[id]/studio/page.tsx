import Link from "next/link";
import { NewDraftForm } from "@/components/studio";
import { StatusBadge, Card, SectionTitle, formatDate } from "@/components/ui";
import { getAI } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

export default async function StudioPage({ params, searchParams }: PageProps<"/projects/[id]/studio">) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: drafts }, { data: runs }, ai] = await Promise.all([
    supabase.from("content_drafts").select("id, title, content_type, target_keyword, status, updated_at").eq("project_id", id).order("updated_at", { ascending: false }),
    supabase.from("research_runs").select("id, kind, query, created_at").eq("project_id", id).eq("status", "done").order("created_at", { ascending: false }).limit(20),
    getAI(supabase),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <SectionTitle
          title="Optimise"
          description="Paste content you've written. Rule-based checks score SEO, GEO, brand compliance and conversion; AI mode also rewrites it with brand facts, SERP insights and customer questions."
        />
        <NewDraftForm
          projectId={id}
          aiEnabled={!!ai}
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
                  <StatusBadge status={d.status} />
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
