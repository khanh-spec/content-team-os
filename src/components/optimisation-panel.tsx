import type { Area, OptimisationReport } from "@/lib/intel/optimise";
import { Card, cn } from "@/components/ui";

const AREAS: { id: Area; label: string }[] = [
  { id: "seo", label: "SEO" },
  { id: "geo", label: "GEO" },
  { id: "brand", label: "Brand" },
  { id: "conversion", label: "Conversion" },
];

const ICON = { pass: "✓", warn: "!", fail: "✗" } as const;
const TONE = { pass: "text-emerald-400", warn: "text-amber-300", fail: "text-red-400" } as const;

function scoreTone(n: number) {
  return n >= 80 ? "bg-emerald-500" : n >= 55 ? "bg-amber-400" : "bg-red-500";
}

export function OptimisationPanel({ report }: { report: OptimisationReport }) {
  return (
    <Card className="space-y-5">
      <div className="flex items-center gap-4">
        <div className={cn("grid h-16 w-16 shrink-0 place-items-center rounded-full text-xl font-semibold text-ink-50", scoreTone(report.overall))}>{report.overall}</div>
        <div>
          <h3 className="font-semibold">Optimisation score</h3>
          <p className="text-xs text-ink-500">
            {report.wordCount.toLocaleString()} words{report.keyword ? ` · “${report.keyword}”` : ""} · rule-based checks
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {AREAS.map((a) => (
          <div key={a.id}>
            <div className="flex justify-between text-xs">
              <span className="text-ink-600">{a.label}</span>
              <span className="tabular-nums">{report.scores[a.id]}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
              <div className={cn("h-full", scoreTone(report.scores[a.id]))} style={{ width: `${report.scores[a.id]}%` }} />
            </div>
          </div>
        ))}
      </div>
      {AREAS.map((a) => {
        const checks = report.checks.filter((c) => c.area === a.id);
        if (!checks.length) return null;
        return (
          <div key={a.id}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">{a.label}</p>
            <ul className="space-y-2">
              {checks
                .slice()
                .sort((x, y) => ["fail", "warn", "pass"].indexOf(x.status) - ["fail", "warn", "pass"].indexOf(y.status))
                .map((c) => (
                  <li key={c.id} className="flex gap-2 text-sm">
                    <span className={cn("w-4 shrink-0 text-center font-bold", TONE[c.status])}>{ICON[c.status]}</span>
                    <div className="min-w-0">
                      <p className="font-medium">{c.label}</p>
                      <p className="text-ink-500">{c.detail}</p>
                      {c.fix && c.status !== "pass" && <p className="text-xs text-brand-800">→ {c.fix}</p>}
                      {c.evidence && c.status !== "pass" && c.evidence.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-ink-500">
                          {c.evidence.slice(0, 4).map((e, i) => (
                            <li key={i} className="truncate">
                              · {e}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        );
      })}
    </Card>
  );
}
