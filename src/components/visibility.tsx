"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/fetcher";
import { Button, ErrorNote, Field, Input, Select, Spinner } from "@/components/ui";

type Plan = { prompts: { prompt: string; angle: string }[]; iterations: number };

async function runQueue<T>(tasks: (() => Promise<T>)[], limit: number) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) await tasks[next++]();
  });
  await Promise.all(workers);
}

export function VisibilityRunner({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [seed, setSeed] = useState("");
  const [prompts, setPrompts] = useState(5);
  const [iterations, setIterations] = useState(3);
  const [phase, setPhase] = useState<"idle" | "planning" | "sampling" | "finalizing">("idle");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase("planning");
    try {
      const { id, plan } = await api<{ id: string; plan: Plan }>(`/api/projects/${projectId}/visibility`, "POST", { seed, prompts, iterations });
      setPlan(plan);
      setPhase("sampling");
      const total = plan.prompts.length * plan.iterations;
      setProgress({ done: 0, failed: 0, total });

      const tasks = plan.prompts.flatMap((_, pi) =>
        Array.from({ length: plan.iterations }, (_, it) => async () => {
          try {
            const r = await api<{ ok: boolean }>(`/api/projects/${projectId}/visibility/${id}/sample`, "POST", { prompt_index: pi, iteration: it });
            setProgress((p) => ({ ...p, done: p.done + 1, failed: p.failed + (r.ok ? 0 : 1) }));
          } catch {
            setProgress((p) => ({ ...p, done: p.done + 1, failed: p.failed + 1 }));
          }
        }),
      );
      await runQueue(tasks, 4);

      setPhase("finalizing");
      await api(`/api/projects/${projectId}/visibility/${id}/finalize`, "POST");
      router.push(`/projects/${projectId}/visibility/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setPhase("idle");
      router.refresh();
    }
  }

  const running = phase !== "idle";

  return (
    <form onSubmit={start} className="space-y-4">
      <Field label="Seed query" hint="Written like a traveller would ask. Don't include the brand name.">
        <Input required disabled={running} value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="best boutique hotel in Hoi An" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fan-out prompts">
          <Select disabled={running} value={prompts} onChange={(e) => setPrompts(Number(e.target.value))}>
            {[3, 5, 8, 10, 12].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </Select>
        </Field>
        <Field label="Runs per prompt">
          <Select disabled={running} value={iterations} onChange={(e) => setIterations(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="text-xs text-ink-500">
        {prompts * iterations} ChatGPT answers with web search + 2 SerpApi searches. Repeated runs matter because AI answers vary between runs.
      </p>

      {running && (
        <div className="space-y-2 rounded-lg bg-ink-50 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <Spinner />
            {phase === "planning" && "Generating fan-out prompts & fetching Maps baseline…"}
            {phase === "sampling" && `Asking ChatGPT… ${progress.done}/${progress.total}`}
            {phase === "finalizing" && "Scoring & writing recommendations…"}
          </p>
          {progress.total > 0 && (
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-200">
              <div className="h-full bg-brand-600 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
          )}
          {progress.failed > 0 && <p className="text-xs text-amber-700">{progress.failed} answer(s) failed. Results use the rest.</p>}
          {plan && (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-ink-600">
              {plan.prompts.map((p, i) => (
                <li key={i}>
                  <span className="text-ink-400">{p.angle}:</span> {p.prompt}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-500">Keep this tab open until it finishes.</p>
        </div>
      )}

      <ErrorNote>{error}</ErrorNote>
      <Button disabled={running} className="w-full">
        Run visibility check
      </Button>
    </form>
  );
}
