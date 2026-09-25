import Link from "next/link";
import { VisibilityRunner } from "@/components/visibility";
import { Badge, Card, Empty, SectionTitle, formatDate, pct } from "@/components/ui";
import { AI_REQUIRED_MESSAGE, getAI } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import type { VisibilitySummary } from "@/lib/research/visibility";

export default async function VisibilityPage({ params }: PageProps<"/projects/[id]/visibility">) {
  const { id } = await params;
  const supabase = await createClient();
  const ai = await getAI(supabase);
  const { data: runs } = await supabase
    .from("research_runs")
    .select("id, query, status, summary, created_at, params")
    .eq("project_id", id)
    .eq("kind", "ai_visibility")
    .order("created_at", { ascending: false });

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div>
        <SectionTitle
          title="AI Visibility"
          description="Which businesses does ChatGPT recommend, compared with Google Maps and the local pack? Runs each fan-out prompt several times with web search on."
        />
        <Card>{ai ? <VisibilityRunner projectId={id} /> : <p className="text-sm text-amber-300">{AI_REQUIRED_MESSAGE} AI Visibility asks ChatGPT the same questions travellers do, so it can&apos;t run in Free mode. Past checks stay viewable.</p>}</Card>
      </div>
      <div>
        <h3 className="mb-3 mt-1 text-sm font-semibold uppercase tracking-wide text-ink-500">Checks</h3>
        {runs?.length ? (
          <Card className="divide-y divide-ink-100 p-0">
            {runs.map((r) => {
              const s = r.summary as VisibilitySummary | null;
              const p = r.params as { prompts?: unknown[]; iterations?: number };
              return (
                <Link key={r.id} href={`/projects/${id}/visibility/${r.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-ink-50">
                  <div>
                    <p className="font-medium">{r.query}</p>
                    <p className="text-xs text-ink-500">
                      {p.prompts?.length ?? 0} prompts × {p.iterations ?? 0} runs · {formatDate(r.created_at)}
                    </p>
                  </div>
                  {s ? (
                    <div className="text-right">
                      <p className="text-lg font-semibold tabular-nums">{pct(s.brand?.ai_mention_rate)}</p>
                      <p className="text-xs text-ink-500">brand mention rate</p>
                    </div>
                  ) : (
                    <Badge tone={r.status === "error" ? "red" : "amber"}>{r.status === "running" ? "incomplete" : r.status}</Badge>
                  )}
                </Link>
              );
            })}
          </Card>
        ) : (
          <Empty title="No checks yet">Try a seed like “best boutique hotel in Hoi An”.</Empty>
        )}
      </div>
    </div>
  );
}
