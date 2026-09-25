// Display blocks for Free Intelligence (rules engine) output. Server- and
// client-safe: no data fetching here.

import type { Angle, CompetitorIntel, Gap, Recommendation, SerpInsight } from "@/lib/intel/serp";
import type { ThemeSummary } from "@/lib/intel/reviews";
import type { CustomerQuestion } from "@/lib/intel/questions";
import type { Entity } from "@/lib/intel/entities";
import { Badge, Card, cn, pillarTone } from "@/components/ui";

const freqTone = { High: "red", Medium: "amber", Low: "gray" } as const;

export function ModeBadge({ mode }: { mode: "free" | "ai" }) {
  return <Badge tone={mode === "ai" ? "brand" : "teal"}>{mode === "ai" ? "AI Enhanced" : "Free Intelligence"}</Badge>;
}

export function IntentSummary({ s }: { s: SerpInsight }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <p className="text-xs uppercase tracking-wide text-ink-500">Search intent</p>
        <p className="mt-1 text-lg font-semibold">{s.intent.label}</p>
        {s.intent.all.length > 1 && <p className="text-xs text-ink-500">Also: {s.intent.all.slice(1).join(", ")}</p>}
      </Card>
      <Card>
        <p className="text-xs uppercase tracking-wide text-ink-500">SERP features</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {s.serpFeatures.length ? s.serpFeatures.map((f) => <Badge key={f}>{f}</Badge>) : <span className="text-sm text-ink-500">Plain organic results</span>}
        </div>
      </Card>
      <Card>
        <p className="text-xs uppercase tracking-wide text-ink-500">Your brand in this search</p>
        <p className="mt-1 text-sm">
          Organic: <strong>{s.brandPresence.organic ? `#${s.brandPresence.organic}` : "not in top 10"}</strong>
          <br />
          Local pack: <strong>{s.brandPresence.localPack ? `#${s.brandPresence.localPack}` : "—"}</strong> · Maps: <strong>{s.brandPresence.maps ? `#${s.brandPresence.maps}` : "—"}</strong>
        </p>
      </Card>
    </div>
  );
}

export function Entities({ items }: { items: Entity[] }) {
  if (!items.length) return <p className="text-sm text-ink-500">No recurring entities found.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((e) => (
        <Badge key={e.name} tone={e.type === "Landmark" ? "blue" : e.type === "Business" ? "violet" : "gray"}>
          {e.name}
          <span className="ml-1 opacity-60">×{e.mentions}</span>
        </Badge>
      ))}
    </div>
  );
}

export function Angles({ items }: { items: Angle[] }) {
  if (!items.length) return <p className="text-sm text-ink-500">Top results don&apos;t share a clear angle.</p>;
  return (
    <ul className="space-y-2">
      {items.map((a) => (
        <li key={a.topic} className="flex items-center gap-3 text-sm">
          <span className="text-emerald-400">✓</span>
          <span className="w-40 shrink-0">{a.label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full bg-brand-600" style={{ width: `${Math.round(a.coverage * 100)}%` }} />
          </div>
          <span className="w-10 text-right tabular-nums text-ink-500">{Math.round(a.coverage * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}

export function Gaps({ items }: { items: Gap[] }) {
  if (!items.length) return <p className="text-sm text-ink-500">No obvious gaps: top results cover what people ask.</p>;
  return (
    <ul className="space-y-3">
      {items.map((g) => (
        <li key={g.topic} className="text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-red-400">❌</span>
            <span className="font-medium">{g.label}</span>
            <Badge>{g.format}</Badge>
            <Badge tone={g.brandCanAnswer ? "green" : "amber"}>{g.brandCanAnswer ? "brand facts ready" : "needs brand facts"}</Badge>
          </div>
          <p className="ml-6 text-ink-500">{g.reason}</p>
        </li>
      ))}
    </ul>
  );
}

export function Questions({ items }: { items: CustomerQuestion[] }) {
  if (!items.length) return <p className="text-sm text-ink-500">No customer questions found.</p>;
  return (
    <ul className="divide-y divide-ink-100">
      {items.map((q) => (
        <li key={q.question} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
          <div className="min-w-0 flex-1">
            <p>{q.question}</p>
            <p className="text-xs text-ink-500">
              {q.sources.join(", ")} · {q.intent}
            </p>
          </div>
          <Badge tone={freqTone[q.frequency]}>{q.frequency}</Badge>
        </li>
      ))}
    </ul>
  );
}

export function Themes({ t, title }: { t: ThemeSummary | null; title: string }) {
  if (!t || (!t.positive.length && !t.negative.length)) return null;
  return (
    <Card>
      <h3 className="mb-3 font-semibold">
        {title} <span className="text-sm font-normal text-ink-500">· {t.reviews} reviews</span>
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["positive", "negative"] as const).map((k) => (
          <div key={k}>
            <p className={cn("mb-2 text-xs font-semibold uppercase", k === "positive" ? "text-emerald-400" : "text-red-400")}>{k === "positive" ? "Positive themes" : "Negative themes"}</p>
            <ul className="space-y-2 text-sm">
              {t[k].map((th) => (
                <li key={th.topic}>
                  <span className="font-medium">{th.label}</span> <span className="text-xs text-ink-500">×{th.count}</span>
                  {th.examples[0] && <p className="text-xs italic text-ink-500">“{th.examples[0]}”</p>}
                </li>
              ))}
              {!t[k].length && <li className="text-ink-500">None found.</li>}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function Competitors({ items }: { items: CompetitorIntel[] }) {
  if (!items.length) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((c) => (
        <div key={c.name} className="rounded-lg border border-ink-200 p-4 text-sm">
          <p className="font-semibold">{c.name}</p>
          <p className="text-xs text-ink-500">
            {c.rating ? `${c.rating}★` : "No rating"}
            {c.reviews ? ` · ${c.reviews.toLocaleString()} reviews` : ""}
            {c.mapsRank ? ` · Maps #${c.mapsRank}` : ""}
            {c.localPackRank ? ` · Local pack #${c.localPackRank}` : ""}
          </p>
          {c.strengths.length > 0 && <p className="mt-2 text-emerald-400">+ {c.strengths.join(", ")}</p>}
          {c.weaknesses.length > 0 && <p className="text-red-400">− {c.weaknesses.join(", ")}</p>}
          {!c.strengths.length && !c.weaknesses.length && <p className="mt-2 text-xs text-ink-500">No reviews collected for this competitor.</p>}
          {c.opportunity && <p className="mt-2 rounded-md bg-brand-50 p-2 text-xs text-brand-900">{c.opportunity}</p>}
        </div>
      ))}
    </div>
  );
}

export function Recommendations({ items }: { items: Recommendation[] }) {
  if (!items.length) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((r, i) => (
        <div key={i} className="rounded-lg border border-ink-200 p-3 text-sm">
          <Badge tone={pillarTone[r.pillar]}>{r.pillar}</Badge>
          <p className="mt-1.5 font-medium">{r.title}</p>
          <p className="text-ink-500">{r.why}</p>
        </div>
      ))}
    </div>
  );
}

export function TopResults({ items }: { items: SerpInsight["topResults"] }) {
  if (!items.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-ink-500">
          <tr>
            <th className="py-2 pr-3 font-medium">#</th>
            <th className="py-2 pr-3 font-medium">Result</th>
            <th className="py-2 pr-3 font-medium">Format</th>
            <th className="py-2 font-medium">Angles</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {items.map((r) => (
            <tr key={r.position}>
              <td className="py-2 pr-3 tabular-nums text-ink-500">{r.position}</td>
              <td className="py-2 pr-3">
                <p>{r.title}</p>
                <p className="font-mono text-xs text-ink-500">{r.domain}</p>
              </td>
              <td className="py-2 pr-3">
                <Badge>{r.format}</Badge>
              </td>
              <td className="py-2 text-xs text-ink-500">{r.angles.join(", ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Full rules-engine report (Market Research). */
export function RulesReport({ s }: { s: SerpInsight }) {
  return (
    <div className="space-y-6">
      <IntentSummary s={s} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-semibold">Top entities</h3>
          <Entities items={s.topEntities} />
        </Card>
        <Card>
          <h3 className="mb-3 font-semibold">Common competitor angles</h3>
          <Angles items={s.competitorAngles} />
        </Card>
        <Card>
          <h3 className="mb-3 font-semibold">Missing opportunities</h3>
          <Gaps items={s.missingOpportunities} />
        </Card>
        <Card>
          <h3 className="mb-3 font-semibold">Customer questions</h3>
          <Questions items={s.customerQuestions} />
        </Card>
      </div>
      <Themes t={s.brandReviewThemes} title="What guests say about your brand" />
      <Themes t={s.reviewThemes} title="Review analysis (all places)" />
      {s.competitors.length > 0 && (
        <Card>
          <h3 className="mb-3 font-semibold">Competitor intelligence</h3>
          <Competitors items={s.competitors} />
        </Card>
      )}
      <Card>
        <h3 className="mb-3 font-semibold">Recommendations</h3>
        <Recommendations items={s.recommendations} />
      </Card>
      <Card>
        <h3 className="mb-3 font-semibold">
          Top results <span className="text-sm font-normal text-ink-500">· {s.contentFormats.map((f) => `${f.count} ${f.format}`).join(", ")}</span>
        </h3>
        <TopResults items={s.topResults} />
      </Card>
    </div>
  );
}
