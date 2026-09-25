import Link from "next/link";
import { BriefForm } from "@/components/brief-view";
import { ModeBadge } from "@/components/insight";
import { Card, Empty, SectionTitle, formatDate } from "@/components/ui";
import { getAI } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

export default async function BriefsPage({ params, searchParams }: PageProps<"/projects/[id]/briefs">) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: briefs }, ai] = await Promise.all([
    supabase.from("content_briefs").select("id, topic, mode, created_at").eq("project_id", id).order("created_at", { ascending: false }),
    getAI(supabase),
  ]);
  return (
    <div className="space-y-6">
      <SectionTitle title="Content Briefs" description="Enter a topic: get search intent, audience, customer questions, required entities, brand integration and internal links." />
      <BriefForm projectId={id} initialTopic={typeof sp.topic === "string" ? sp.topic : ""} aiEnabled={!!ai} />
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Saved briefs</h3>
        {briefs?.length ? (
          <Card className="divide-y divide-ink-100 p-0">
            {briefs.map((b) => (
              <Link key={b.id} href={`/projects/${id}/briefs/${b.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-ink-100">
                <span className="font-medium">{b.topic}</span>
                <span className="flex items-center gap-3 text-xs text-ink-500">
                  <ModeBadge mode={b.mode as "free" | "ai"} />
                  {formatDate(b.created_at)}
                </span>
              </Link>
            ))}
          </Card>
        ) : (
          <Empty title="No briefs yet">Try “Best things to do in [your city]” or a query from Opportunities.</Empty>
        )}
      </div>
    </div>
  );
}
