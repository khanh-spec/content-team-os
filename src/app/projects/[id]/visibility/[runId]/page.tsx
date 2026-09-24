import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteRun } from "@/components/delete-run";
import { FinalizeButton } from "@/components/finalize-button";
import { Badge, Card, Stat, cn, formatDate, pct, pillarTone, severityTone } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { Citation, Mention, SerpBaseline, VisibilityPlan, VisibilitySummary } from "@/lib/research/visibility";
import type { ResearchRun } from "@/lib/types";

const GAP = {
  both: { label: "AI + Maps", tone: "green" },
  ai_only: { label: "AI only", tone: "violet" },
  serp_only: { label: "Maps only · AI gap", tone: "amber" },
  neither: { label: "Neither", tone: "gray" },
} as const;

export default async function VisibilityRunPage({ params }: PageProps<"/projects/[id]/visibility/[runId]">) {
  const { id, runId } = await params;
  const supabase = await createClient();
  const [{ data }, { data: samples }] = await Promise.all([
    supabase.from("research_runs").select("*").eq("id", runId).eq("project_id", id).maybeSingle(),
    supabase.from("visibility_samples").select("prompt_index, iteration, prompt, answer, mentions, citations, error").eq("run_id", runId).order("prompt_index").order("iteration"),
  ]);
  if (!data) notFound();
  const run = data as ResearchRun<VisibilitySummary, { baseline: SerpBaseline }>;
  const plan = run.params as unknown as VisibilityPlan;
  const s = run.summary;
  const expected = plan.prompts.length * plan.iterations;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/projects/${id}/visibility`} className="text-sm text-ink-500 hover:text-ink-800">
            ← AI visibility
          </Link>
          <h2 className="mt-1 text-xl font-semibold">{run.query}</h2>
          <p className="text-sm text-ink-500">
            {plan.prompts.length} prompts × {plan.iterations} runs · {samples?.length ?? 0}/{expected} answers · {formatDate(run.created_at)}
          </p>
        </div>
        <div className="flex gap-2">
          {(samples?.length ?? 0) > 0 && <FinalizeButton projectId={id} runId={runId} label={s ? "Recalculate" : "Score available answers"} />}
          <DeleteRun projectId={id} runId={run.id} back={`/projects/${id}/visibility`} />
        </div>
      </div>

      {!s && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">This check hasn&apos;t been scored yet (it may have been interrupted). Score the answers collected so far.</p>}
      {run.sources?.baseline.errors.length ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{run.sources.baseline.errors.join(" · ")}</p> : null}

      {s && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Brand mention rate" value={pct(s.brand?.ai_mention_rate)} hint={`${s.brand?.ai_samples ?? 0} of ${s.successful_samples} answers`} />
            <Stat label="Share of voice" value={pct(s.brand_share_of_voice)} hint="of all business mentions" />
            <Stat label="Avg. position in answer" value={s.brand?.ai_avg_position ? s.brand.ai_avg_position.toFixed(1) : "–"} />
            <Stat label="Google Maps rank" value={s.brand?.maps_rank ?? "–"} hint={s.brand?.local_pack_rank ? `Local pack #${s.brand.local_pack_rank}` : "Not in local pack"} />
            <Stat label="Per answer" value={s.avg_mentions_per_answer.toFixed(1)} hint={`businesses · ${s.avg_citations_per_answer.toFixed(1)} citations`} />
          </div>

          {s.insights && (
            <Card>
              <h3 className="font-semibold">{s.insights.headline}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-700">
                {s.insights.findings.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {s.insights.recommendations.map((r, i) => (
                  <div key={i} className="rounded-lg border border-ink-100 p-3 text-sm">
                    <div className="mb-1 flex gap-1.5">
                      <Badge tone={severityTone[r.priority]}>{r.priority}</Badge>
                      <Badge tone={pillarTone[r.pillar]}>{r.pillar}</Badge>
                    </div>
                    <p className="font-medium">{r.action}</p>
                    <p className="mt-0.5 text-ink-600">{r.why}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="overflow-x-auto p-0">
            <div className="px-5 pt-4">
              <h3 className="font-semibold">ChatGPT vs Google Maps / local pack</h3>
              <p className="text-sm text-ink-500">Businesses mentioned in ChatGPT answers, plus the top 10 on Maps.</p>
            </div>
            <table className="mt-3 w-full min-w-[760px] text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Business</th>
                  <th className="px-4 py-2 font-medium">ChatGPT mention rate</th>
                  <th className="px-4 py-2 font-medium">Avg. pos.</th>
                  <th className="px-4 py-2 font-medium">Prompts</th>
                  <th className="px-4 py-2 font-medium">Maps rank</th>
                  <th className="px-4 py-2 font-medium">Local pack</th>
                  <th className="px-4 py-2 font-medium">Rating</th>
                  <th className="px-4 py-2 font-medium">Pattern</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {s.businesses.slice(0, 40).map((b) => (
                  <tr key={b.name} className={cn(b.role === "brand" && "bg-brand-50/60")}>
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{b.name}</span>
                      {b.role !== "other" && (
                        <Badge tone={b.role === "brand" ? "brand" : "violet"} className="ml-2">
                          {b.role}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-100">
                          <div className={cn("h-full", b.role === "brand" ? "bg-brand-600" : "bg-ink-500")} style={{ width: `${b.ai_mention_rate * 100}%` }} />
                        </div>
                        <span className="tabular-nums">{pct(b.ai_mention_rate)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{b.ai_avg_position?.toFixed(1) ?? "–"}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {b.ai_prompts}/{plan.prompts.length}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{b.maps_rank ?? "–"}</td>
                    <td className="px-4 py-2.5 tabular-nums">{b.local_pack_rank ?? "–"}</td>
                    <td className="px-4 py-2.5 tabular-nums text-ink-600">{b.maps_rating ? `${b.maps_rating}★ (${b.maps_reviews ?? 0})` : "–"}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={GAP[b.gap].tone}>{GAP[b.gap].label}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3 font-semibold">Where ChatGPT gets its information</h3>
              <ul className="space-y-1.5 text-sm">
                {s.citation_domains.map((d) => (
                  <li key={d.domain} className="flex items-center justify-between gap-2">
                    <span className="truncate">{d.domain}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge>{d.kind}</Badge>
                      <span className="w-8 text-right tabular-nums text-ink-600">{d.count}</span>
                    </span>
                  </li>
                ))}
                {!s.citation_domains.length && <li className="text-ink-500">No citations returned.</li>}
              </ul>
            </Card>
            <Card>
              <h3 className="mb-3 font-semibold">By prompt</h3>
              <ul className="space-y-3 text-sm">
                {s.per_prompt.map((p, i) => (
                  <li key={i}>
                    <div className="flex items-start justify-between gap-3">
                      <span>
                        <span className="text-xs text-ink-400">{p.angle} · </span>
                        {p.prompt}
                      </span>
                      <span className={cn("shrink-0 font-semibold tabular-nums", p.brand_rate > 0 ? "text-brand-700" : "text-ink-400")}>{pct(p.brand_rate)}</span>
                    </div>
                    <p className="text-xs text-ink-500">Top: {p.top.join(", ") || "–"}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}

      <Card>
        <h3 className="mb-3 font-semibold">ChatGPT answers</h3>
        <div className="space-y-2">
          {(samples ?? []).map((smp) => (
            <details key={`${smp.prompt_index}-${smp.iteration}`} className="rounded-lg border border-ink-100 px-3 py-2 text-sm">
              <summary className="cursor-pointer">
                <span className="font-medium">{smp.prompt}</span> <span className="text-xs text-ink-500">· run {smp.iteration + 1}</span>
                {smp.error ? <Badge tone="red" className="ml-2">error</Badge> : <span className="ml-2 text-xs text-ink-500">{(smp.mentions as Mention[] | null)?.length ?? 0} businesses</span>}
              </summary>
              {smp.error ? (
                <p className="mt-2 text-red-700">{smp.error}</p>
              ) : (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {((smp.mentions as Mention[] | null) ?? []).map((m, i) => (
                      <Badge key={i} tone={m.sentiment === "negative" ? "red" : "gray"}>
                        {m.position}. {m.canonical || m.name}
                      </Badge>
                    ))}
                  </div>
                  <p className="whitespace-pre-wrap text-ink-700">{smp.answer}</p>
                  {((smp.citations as Citation[] | null) ?? []).length > 0 && (
                    <ul className="text-xs">
                      {((smp.citations as Citation[]) ?? []).map((c) => (
                        <li key={c.url}>
                          <a href={c.url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                            {c.title || c.domain}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
