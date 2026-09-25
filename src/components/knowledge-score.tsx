import type { KnowledgeItem } from "@/lib/intel/knowledge";
import { Card, cn } from "@/components/ui";

export function KnowledgeScoreCard({ score, items, compact = false }: { score: number; items: KnowledgeItem[]; compact?: boolean }) {
  const missing = items.filter((i) => !i.ok);
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Brand Knowledge Score</h3>
        <span className={cn("text-2xl font-semibold tabular-nums", score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-300" : "text-red-400")}>{score}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-100">
        <div className={cn("h-full", score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-400" : "bg-red-500")} style={{ width: `${score}%` }} />
      </div>
      {missing.length > 0 ? (
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-ink-500">Missing</p>
          <ul className="space-y-1.5 text-sm">
            {missing.slice(0, compact ? 5 : missing.length).map((m) => (
              <li key={m.label}>
                <span className="text-ink-800">– {m.label}</span>
                {!compact && <span className="block pl-3 text-xs text-ink-500">{m.hint}</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-emerald-400">Complete. The writer has everything it needs.</p>
      )}
    </Card>
  );
}
