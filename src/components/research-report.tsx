// Market Research report: Free Intelligence (rules engine) + optional AI
// synthesis + raw sources. Used by the saved-run page and inline in preview.

import Link from "next/link";
import { ModeBadge, RulesReport } from "@/components/insight";
import { Badge, Card, pillarTone } from "@/components/ui";
import type { SerpInsight } from "@/lib/intel/serp";
import type { LocalSources, LocalSummary } from "@/lib/research/local";

const sentimentTone = { positive: "green", negative: "red", mixed: "amber", neutral: "gray" } as const;
const canAnswerTone = { yes: "green", partially: "amber", no: "red", unknown: "gray" } as const;

export type StoredResearch = { rules?: SerpInsight; ai?: LocalSummary; aiError?: string } | LocalSummary;

/** Older runs stored the AI summary directly. */
export function splitSummary(summary: StoredResearch | null): { rules?: SerpInsight; ai?: LocalSummary; aiError?: string } {
  if (!summary) return {};
  if ("rules" in summary || "ai" in summary || "aiError" in summary) return summary as { rules?: SerpInsight; ai?: LocalSummary; aiError?: string };
  return { ai: summary as LocalSummary };
}

export function ResearchReport({ projectId, summary, src }: { projectId: string; summary: StoredResearch | null; src: LocalSources | null }) {
  const { rules, ai, aiError } = splitSummary(summary);
  const id = projectId;
  return (
    <div className="space-y-8">
      {src?.errors?.length ? (
        <details className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          <summary>{src.errors.length} source(s) returned errors</summary>
          <ul className="mt-2 list-disc pl-5">
            {src.errors.map((e, i) => (
              <li key={i}>
                {e.source}: {e.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {rules && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Search & market intelligence</h3>
            <ModeBadge mode="free" />
          </div>
          <RulesReport s={rules} />
        </section>
      )}

      {aiError && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">AI synthesis failed: {aiError}</p>}
      {ai && <AiSynthesis s={ai} id={id} />}

      {src && (
        <Card>
          <h3 className="mb-3 font-semibold">Raw sources</h3>
          <div className="space-y-2 text-sm">
            <SourceList title={`People Also Ask (${src.questions.length})`} items={src.questions.map((q) => ({ title: q.question, text: q.snippet, link: q.link }))} />
            <SourceList title={`Google Maps (${src.maps.length})`} items={src.maps.map((b) => ({ title: `${b.position}. ${b.title}`, text: `${b.rating ?? "?"}★ · ${b.reviews ?? 0} reviews · ${b.type ?? ""}` }))} />
            <SourceList title={`Local pack (${src.localPack.length})`} items={src.localPack.map((b) => ({ title: `${b.position}. ${b.title}`, text: `${b.rating ?? "?"}★ · ${b.reviews ?? 0} reviews` }))} />
            <SourceList title={`Reviews (${src.reviews.length})`} items={src.reviews.map((r) => ({ title: `${r.source} · ${r.place} · ${r.rating ?? "?"}★ ${r.date ?? ""}`, text: r.text }))} />
            <SourceList title={`Tripadvisor (${src.tripadvisor.length})`} items={src.tripadvisor.map((p) => ({ title: p.title, text: `${p.rating ?? "?"}★ · ${p.reviews ?? 0} reviews`, link: p.link }))} />
            <SourceList title={`Forums (${src.forums.length})`} items={src.forums.map((f) => ({ title: f.title, text: f.snippet, link: f.link }))} />
            <SourceList title={`Reddit (${src.reddit.length})`} items={src.reddit.map((f) => ({ title: f.title, text: f.snippet, link: f.link }))} />
            <SourceList title={`Booking.com (${src.booking.length})`} items={src.booking.map((f) => ({ title: f.title, text: f.snippet, link: f.link }))} />
            <SourceList title={`Organic results (${src.organic.length})`} items={src.organic.map((r) => ({ title: `${r.position}. ${r.title}`, text: r.snippet, link: r.link }))} />
            {src.aiOverview && <SourceList title="Google AI Overview" items={[{ title: "AI Overview", text: src.aiOverview }]} />}
          </div>
        </Card>
      )}
    </div>
  );
}

function AiSynthesis({ s, id }: { s: LocalSummary; id: string }) {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">AI synthesis</h3>
        <ModeBadge mode="ai" />
      </div>
          <Card>
            <p className="leading-relaxed text-ink-800">{s.overview}</p>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3 font-semibold">Customer questions</h3>
              <ul className="space-y-2 text-sm">
                {s.customer_questions.map((q, i) => (
                  <li key={i} className="flex items-start justify-between gap-3">
                    <span>{q.question}</span>
                    <span className="flex shrink-0 gap-1">
                      <Badge>{q.source}</Badge>
                      <Badge tone={canAnswerTone[q.brand_can_answer]} className="whitespace-nowrap">
                        brand: {q.brand_can_answer}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <h3 className="mb-3 font-semibold">Themes from reviews & forums</h3>
              <ul className="space-y-3 text-sm">
                {s.themes.map((t, i) => (
                  <li key={i}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t.theme}</span>
                      <Badge tone={sentimentTone[t.sentiment]}>{t.sentiment}</Badge>
                      <span className="text-xs text-ink-500">{t.sources.join(", ")}</span>
                    </div>
                    <ul className="mt-1 space-y-0.5 text-ink-600">
                      {t.evidence.slice(0, 3).map((e, j) => (
                        <li key={j} className="italic">
                          “{e}”
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <h3 className="mb-3 font-semibold">Brand perception</h3>
              {!s.brand_perception.found_in_sources && <p className="mb-2 text-xs text-amber-300">The brand barely appears in these sources, which is itself a finding.</p>}
              <p className="text-sm text-ink-800">{s.brand_perception.summary}</p>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-emerald-400">Strengths</p>
                  <ul className="list-disc space-y-0.5 pl-4">{s.brand_perception.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-red-300">Weaknesses</p>
                  <ul className="list-disc space-y-0.5 pl-4">{s.brand_perception.weaknesses.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="mb-3 font-semibold">Competitors</h3>
              <ul className="space-y-3 text-sm">
                {s.competitor_insights.map((c, i) => (
                  <li key={i}>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-ink-500">{c.visibility}</p>
                    <p className="mt-0.5 text-ink-700">{c.positioning}</p>
                    <p className="mt-0.5 text-xs">
                      <span className="text-emerald-400">+ {c.strengths.join("; ")}</span>
                      {c.weaknesses.length > 0 && <span className="text-red-300"> · − {c.weaknesses.join("; ")}</span>}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <h3 className="mb-3 font-semibold">Local facts found</h3>
              <ul className="space-y-1.5 text-sm">
                {s.local_facts.map((f, i) => (
                  <li key={i}>
                    {f.fact}{" "}
                    <span className="text-xs text-ink-500">
                      ({f.source}, {f.confidence})
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-ink-500">Verify before publishing. These come from third-party snippets.</p>
            </Card>

            <Card>
              <h3 className="mb-3 font-semibold">How guests phrase it</h3>
              <div className="flex flex-wrap gap-1.5">
                {s.customer_vocabulary.map((v, i) => (
                  <Badge key={i} tone="blue">
                    {v}
                  </Badge>
                ))}
              </div>
            </Card>
          </div>

          <Card>
            <h3 className="mb-3 font-semibold">Content angles</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {s.content_angles.map((c, i) => (
                <div key={i} className="rounded-lg border border-ink-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{c.title}</p>
                    <Badge tone={pillarTone[c.pillar]}>{c.pillar}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">Query: {c.target_query}</p>
                  <p className="mt-1 text-sm text-ink-700">{c.why}</p>
                  <Link
                    className="mt-2 inline-block text-xs font-medium text-brand-700 hover:underline"
                    href={`/projects/${id}/studio?title=${encodeURIComponent(c.title)}&keyword=${encodeURIComponent(c.target_query)}&brief=${encodeURIComponent(c.why)}`}
                  >
                    Draft this →
                  </Link>
                </div>
              ))}
            </div>
          </Card>
    </section>
  );
}

function SourceList({ title, items }: { title: string; items: { title: string; text?: string; link?: string }[] }) {
  if (!items.length) return null;
  return (
    <details className="rounded-lg border border-ink-100 px-3 py-2">
      <summary className="cursor-pointer font-medium">{title}</summary>
      <ul className="mt-2 space-y-2">
        {items.map((it, i) => (
          <li key={i}>
            {it.link ? (
              <a href={it.link} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
                {it.title}
              </a>
            ) : (
              <p className="font-medium">{it.title}</p>
            )}
            {it.text && <p className="whitespace-pre-wrap text-ink-600">{it.text}</p>}
          </li>
        ))}
      </ul>
    </details>
  );
}
