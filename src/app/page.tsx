import { FileText, FolderKanban, Radar, Sparkles } from "lucide-react";
import Link from "next/link";
import { ButtonLink, Empty, Stat } from "@/components/ui";
import { IN_FLIGHT, PIPELINE } from "@/lib/pipeline";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";

type ProjectCard = Pick<Project, "id" | "name" | "brand_summary" | "industry" | "property_type"> & { content_drafts: { count: number }[] };

export default async function Dashboard() {
  const supabase = await createClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [{ data: userData }, { data: projectRows }, { data: drafts }, { data: runs }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("projects").select("id, name, brand_summary, industry, property_type, updated_at, content_drafts(count)").order("updated_at", { ascending: false }),
    supabase.from("content_drafts").select("status"),
    supabase.from("research_runs").select("created_at"),
  ]);
  const projects = (projectRows ?? []) as ProjectCard[];
  const statuses = (drafts ?? []).map((d) => d.status as string);
  const runsThisMonth = (runs ?? []).filter((r) => (r.created_at as string) >= monthStart).length;

  const meta = userData.user?.user_metadata as { full_name?: string } | undefined;
  const email = userData.user?.email ?? "";
  const name = meta?.full_name?.split(" ")[0] || email.split("@")[0].replace(/^\w/, (c) => c.toUpperCase());

  return (
    <div className="space-y-6 px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Welcome back, {name}</h1>
          <p className="text-sm text-ink-500">Pick a project to start writing, or review what&apos;s in flight across the workspace.</p>
        </div>
        <ButtonLink href="/projects/new" variant="secondary">
          New project
        </ButtonLink>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<FolderKanban size={18} />} value={projects.length} label="Projects" />
        <Stat icon={<FileText size={18} />} value={statuses.length} label="Content pieces" />
        <Stat icon={<Sparkles size={18} />} value={statuses.filter((s) => IN_FLIGHT.includes(s)).length} label="In flight" />
        <Stat icon={<Radar size={18} />} value={runsThisMonth} label="Research & AI checks this month" />
      </div>

      <section className="rounded-xl border border-ink-200 bg-surface p-5">
        <h2 className="mb-4 font-semibold">Content pipeline</h2>
        <div className="flex flex-wrap gap-3">
          {PIPELINE.map((p) => (
            <div key={p.value} className="flex items-center gap-3 rounded-lg border border-ink-200 px-3 py-2">
              <PipelinePill tone={p.tone}>{p.label}</PipelinePill>
              <span className="font-mono text-base tabular-nums">{statuses.filter((s) => s === p.value).length}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Projects</h2>
        {projects.length === 0 ? (
          <Empty title="No projects yet">Create the first client space to start adding brand materials.</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="group flex flex-col rounded-xl border border-ink-200 bg-surface p-5 transition hover:border-brand-300 hover:bg-surface-2">
                <h3 className="font-semibold group-hover:text-brand-800">{p.name}</h3>
                <p className="mt-1 line-clamp-2 flex-1 text-sm text-ink-500">{p.brand_summary || "No brand summary yet."}</p>
                <p className="mt-4 font-mono text-xs text-ink-500">
                  {p.content_drafts[0]?.count ?? 0} {p.content_drafts[0]?.count === 1 ? "piece" : "pieces"} · {(p.property_type || p.industry).toLowerCase()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const PILL = {
  gray: "bg-ink-100 text-ink-700 ring-ink-300",
  blue: "bg-blue-500/10 text-blue-300 ring-blue-500/40",
  violet: "bg-violet-500/10 text-violet-300 ring-violet-500/40",
  amber: "bg-amber-500/10 text-amber-300 ring-amber-500/40",
  green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/40",
  teal: "bg-teal-500/10 text-teal-300 ring-teal-500/40",
} as const;

function PipelinePill({ tone, children }: { tone: keyof typeof PILL; children: React.ReactNode }) {
  return <span className={`rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${PILL[tone]}`}>{children}</span>;
}
