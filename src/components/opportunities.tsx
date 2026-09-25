"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/fetcher";
import type { Opportunity, Pillar } from "@/lib/gsc/opportunities";
import type { OpportunityReport } from "@/lib/gsc/report";
import type { SerpInsight } from "@/lib/intel/serp";
import { Gaps, Recommendations } from "@/components/insight";
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Select, Spinner, Stat, cn, formatDate, pillarTone, severityTone } from "@/components/ui";

const PILLAR_INFO: Record<Pillar, string> = {
  company: "Branded & brand-fact queries: make facts explicit and quotable",
  customers: "Questions & local intent: answer with first-hand local knowledge",
  competitors: "Competitor names & comparisons: honest, provable differentiation",
};

export function Opportunities({
  projectId,
  opportunities,
  importedAt,
  periodLabel,
  report,
  gscStatus,
}: {
  projectId: string;
  opportunities: Opportunity[];
  importedAt: string | null;
  periodLabel: string | null;
  report: { created_at: string; report: OpportunityReport } | null;
  gscStatus: string;
}) {
  const router = useRouter();
  const [pillar, setPillar] = useState<"all" | Pillar>("all");
  const [tail, setTail] = useState<"all" | "short" | "long">("all");
  const [signal, setSignal] = useState("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("Last 3 months");
  const [plan, setPlan] = useState(report);
  const [map, setMap] = useState<{ query: string; insight?: SerpInsight; loading: boolean; error?: string } | null>(null);
  const [mapQuery, setMapQuery] = useState("");

  async function analyse(query: string) {
    setMap({ query, loading: true });
    try {
      const { insight } = await api<{ insight: SerpInsight }>(`/api/projects/${projectId}/serp-analysis`, "POST", { query });
      setMap({ query, insight, loading: false });
    } catch (e) {
      setMap({ query, loading: false, error: (e as Error).message });
    }
  }

  const signals = useMemo(() => [...new Set(opportunities.flatMap((o) => o.signals))].sort(), [opportunities]);
  const filtered = opportunities.filter(
    (o) =>
      (pillar === "all" || o.pillar === pillar) &&
      (tail === "all" || o.tail === tail) &&
      (signal === "all" || o.signals.includes(signal)) &&
      (!q || o.query.toLowerCase().includes(q.toLowerCase())),
  );
  const count = (p: Pillar) => opportunities.filter((o) => o.pillar === p).length;

  async function importCsv(file: File) {
    setBusy("import");
    setError(null);
    try {
      const csv = await file.text();
      await api(`/api/projects/${projectId}/gsc`, "POST", { csv, period_label: period, replace: true });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    setBusy("report");
    setError(null);
    try {
      const res = await api<{ id?: string; report?: { report: OpportunityReport; created_at: string } }>(`/api/projects/${projectId}/opportunities`, "POST");
      if (res.report) setPlan(res.report);
      else router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="space-y-3">
          <h3 className="font-semibold">Import Search Console data</h3>
          <p className="text-sm text-ink-600">
            In Search Console open <em>Performance → Search results</em>, pick a date range, then <em>Export → Download CSV</em>. Upload the <strong>Queries.csv</strong> file from the zip.
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Period label">
              <Input value={period} onChange={(e) => setPeriod(e.target.value)} />
            </Field>
            <label className="self-end">
              <span className={cn("inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800", busy && "opacity-60")}>
                {busy === "import" && <Spinner />} Upload CSV
              </span>
              <input type="file" accept=".csv,text/csv" className="hidden" disabled={!!busy} onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
            </label>
          </div>
          {importedAt && (
            <p className="text-xs text-ink-500">
              {opportunities.length.toLocaleString()} queries · {periodLabel ?? ""} · imported {formatDate(importedAt)}
            </p>
          )}
        </Card>

        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Search Console API</h3>
            <Badge tone={gscStatus === "connected" ? "green" : "gray"}>{gscStatus === "connected" ? "Connected" : "Phase 2"}</Badge>
          </div>
          <p className="text-sm text-ink-600">
            Direct OAuth sync (daily query + page data, per-page drill-down) is planned for phase 2. The data model is ready; CSV import feeds the same analysis in the meantime.
          </p>
          <Button variant="secondary" disabled>
            Connect Google Search Console
          </Button>
        </Card>
      </div>

      <ErrorNote>{error}</ErrorNote>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-semibold">Search Opportunity Map</h3>
            <p className="text-sm text-ink-500">What competitors cover for a query, what&apos;s missing, and what to create. Click “Map” on any query below, or type one.</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (mapQuery.trim()) analyse(mapQuery.trim());
            }}
            className="flex gap-2"
          >
            <Input value={mapQuery} onChange={(e) => setMapQuery(e.target.value)} placeholder="family hotel da nang" className="w-64" />
            <Button variant="secondary" disabled={map?.loading}>
              Analyse
            </Button>
          </form>
        </div>
        {map && <OpportunityMap projectId={projectId} state={map} />}
      </Card>

      {opportunities.length === 0 ? (
        <Empty title="No Search Console data yet">Import a Queries CSV to see 3C content opportunities.</Empty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {(["company", "customers", "competitors"] as const).map((p) => (
              <button key={p} onClick={() => setPillar(pillar === p ? "all" : p)} className="text-left">
                <Stat label={p} value={count(p)} hint={PILLAR_INFO[p]} />
              </button>
            ))}
          </div>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">3C content plan</h3>
                <p className="text-sm text-ink-500">Groups queries into briefs using your brand facts, local research and AI visibility data.</p>
              </div>
              <Button onClick={generate} disabled={!!busy}>
                {busy === "report" ? (
                  <>
                    <Spinner /> Building plan…
                  </>
                ) : plan ? (
                  "Rebuild plan"
                ) : (
                  "Build content plan"
                )}
              </Button>
            </div>
            {plan && <ReportView projectId={projectId} data={plan} />}
          </Card>

          <Card className="p-0">
            <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
              <Select value={pillar} onChange={(e) => setPillar(e.target.value as typeof pillar)} className="w-auto">
                <option value="all">All pillars</option>
                <option value="company">Company</option>
                <option value="customers">Customers</option>
                <option value="competitors">Competitors</option>
              </Select>
              <Select value={tail} onChange={(e) => setTail(e.target.value as typeof tail)} className="w-auto">
                <option value="all">Short + long tail</option>
                <option value="short">Short tail (1–3 words)</option>
                <option value="long">Long tail (4+ words)</option>
              </Select>
              <Select value={signal} onChange={(e) => setSignal(e.target.value)} className="w-auto">
                <option value="all">Any signal</option>
                {signals.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
              <Input placeholder="Filter queries…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
              <span className="ml-auto text-sm text-ink-500">{filtered.length.toLocaleString()} queries</span>
            </div>
            <div className="mt-3 max-h-[640px] overflow-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="sticky top-0 bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Query</th>
                    <th className="px-4 py-2 font-medium">Pillar</th>
                    <th className="px-4 py-2 text-right font-medium">Clicks</th>
                    <th className="px-4 py-2 text-right font-medium">Impr.</th>
                    <th className="px-4 py-2 text-right font-medium">CTR</th>
                    <th className="px-4 py-2 text-right font-medium">Pos.</th>
                    <th className="px-4 py-2 font-medium">Signals</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {filtered.slice(0, 500).map((o, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2">
                        {o.query}
                        {o.page && <p className="max-w-md truncate text-xs text-ink-400">{o.page}</p>}
                      </td>
                      <td className="px-4 py-2">
                        <Badge tone={pillarTone[o.pillar]}>{o.pillar}</Badge>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{o.clicks.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{o.impressions.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{o.ctr != null ? `${(o.ctr * 100).toFixed(1)}%` : "–"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{o.position?.toFixed(1) ?? "–"}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {o.signals.map((s) => (
                            <Badge key={s}>{s}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => analyse(o.query)} className="mr-3 text-xs font-medium text-brand-800 hover:underline">
                          Map
                        </button>
                        <Link href={`/projects/${projectId}/briefs?topic=${encodeURIComponent(o.query)}`} className="text-xs font-medium text-brand-700 hover:underline">
                          Brief
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

const ACTION_LABEL: Record<OpportunityReport["briefs"][number]["action"], string> = {
  new_page: "New page",
  update_existing: "Update page",
  faq_block: "FAQ block",
  title_meta_rewrite: "Title / meta",
  comparison_page: "Comparison",
  local_guide: "Local guide",
};

function ReportView({ projectId, data }: { projectId: string; data: { created_at: string; report: OpportunityReport } }) {
  const r = data.report;
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-800">{r.summary}</p>
      <p className="text-xs text-ink-500">Generated {formatDate(data.created_at)}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {r.briefs.map((b, i) => (
          <div key={i} className="rounded-lg border border-ink-200 p-4 text-sm">
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Badge tone={severityTone[b.priority]}>{b.priority}</Badge>
              <Badge tone={pillarTone[b.pillar]}>{b.pillar}</Badge>
              <Badge>{ACTION_LABEL[b.action]}</Badge>
            </div>
            <p className="font-semibold">{b.title}</p>
            <p className="mt-1 text-xs text-ink-500">
              {b.primary_query}
              {b.supporting_queries.length > 0 && ` + ${b.supporting_queries.length} related`} · {b.target_page === "new" ? "new page" : b.target_page}
            </p>
            {b.customer_questions.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-ink-700">
                {b.customer_questions.slice(0, 4).map((q, j) => (
                  <li key={j}>{q}</li>
                ))}
              </ul>
            )}
            {b.brand_facts_to_use.length > 0 && (
              <p className="mt-2 text-xs">
                <span className="font-medium">Facts: </span>
                {b.brand_facts_to_use.map((f, j) => (
                  <span key={j} className={cn(f.startsWith("MISSING") && "text-amber-300")}>
                    {f}
                    {j < b.brand_facts_to_use.length - 1 ? "; " : ""}
                  </span>
                ))}
              </p>
            )}
            {b.competitor_angle && <p className="mt-1 text-xs text-ink-600">Competitors: {b.competitor_angle}</p>}
            <p className="mt-1 text-xs text-ink-600">GEO: {b.geo_note}</p>
            <Link
              href={`/projects/${projectId}/studio?title=${encodeURIComponent(b.title)}&keyword=${encodeURIComponent(b.primary_query)}&brief=${encodeURIComponent(
                `Answer: ${b.customer_questions.join(" | ")}\nUse facts: ${b.brand_facts_to_use.join("; ")}\nCompetitor angle: ${b.competitor_angle}`,
              )}`}
              className="mt-2 inline-block text-xs font-medium text-brand-700 hover:underline"
            >
              Open in Content Studio →
            </Link>
          </div>
        ))}
      </div>
      {r.missing_brand_facts.length > 0 && (
        <div className="rounded-lg bg-amber-500/10 p-3 text-sm">
          <p className="font-medium text-amber-300">Facts to request from the client</p>
          <ul className="mt-1 list-disc pl-5 text-amber-300">
            {r.missing_brand_facts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function OpportunityMap({ projectId, state }: { projectId: string; state: { query: string; insight?: SerpInsight; loading: boolean; error?: string } }) {
  if (state.loading)
    return (
      <p className="flex items-center gap-2 text-sm text-ink-500">
        <Spinner /> Analysing “{state.query}”…
      </p>
    );
  if (state.error) return <ErrorNote>{state.error}</ErrorNote>;
  const s = state.insight;
  if (!s) return null;
  return (
    <div className="grid gap-5 rounded-lg border border-ink-200 p-4 lg:grid-cols-3">
      <div className="space-y-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-500">Query</p>
          <p className="font-medium">{s.query}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-500">Intent</p>
          <p className="font-medium">{s.intent.label}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-500">Your brand</p>
          <p>
            Organic {s.brandPresence.organic ? `#${s.brandPresence.organic}` : "—"} · Local pack {s.brandPresence.localPack ? `#${s.brandPresence.localPack}` : "—"}
          </p>
        </div>
        <Link href={`/projects/${projectId}/briefs?topic=${encodeURIComponent(s.query)}`} className="inline-block text-sm font-medium text-brand-800 hover:underline">
          Create a brief for this query →
        </Link>
      </div>
      <div className="text-sm">
        <p className="mb-2 text-xs uppercase tracking-wide text-ink-500">SERP coverage: competitors mention</p>
        <ul className="space-y-1">
          {s.competitorAngles.map((a) => (
            <li key={a.topic}>
              <span className="text-emerald-400">✓</span> {a.label} <span className="text-xs text-ink-500">({Math.round(a.coverage * 100)}%)</span>
            </li>
          ))}
          {!s.competitorAngles.length && <li className="text-ink-500">No shared angle.</li>}
        </ul>
      </div>
      <div className="text-sm">
        <p className="mb-2 text-xs uppercase tracking-wide text-ink-500">Missing</p>
        <Gaps items={s.missingOpportunities.slice(0, 4)} />
      </div>
      <div className="lg:col-span-3">
        <p className="mb-2 text-xs uppercase tracking-wide text-ink-500">Recommendation</p>
        <Recommendations items={s.recommendations.slice(0, 4)} />
      </div>
    </div>
  );
}
