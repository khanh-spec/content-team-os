import Link from "next/link";
import { ButtonLink, Empty } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, name, brand_name, city, country, property_type, updated_at, documents(count), content_drafts(count), feedback_logs(count)")
    .order("updated_at", { ascending: false });
  const projects = (data ?? []) as (Pick<Project, "id" | "name" | "brand_name" | "city" | "country" | "property_type" | "updated_at"> & {
    documents: { count: number }[];
    content_drafts: { count: number }[];
    feedback_logs: { count: number }[];
  })[];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-ink-500">One space per client: brand knowledge, feedback, research and content.</p>
        </div>
        <ButtonLink href="/projects/new">New project</ButtonLink>
      </div>

      {projects.length === 0 ? (
        <Empty title="No projects yet">Create the first client space to start adding brand materials.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="group rounded-xl border border-ink-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                {[p.property_type, [p.city, p.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "Hospitality"}
              </p>
              <h2 className="mt-1 text-lg font-semibold group-hover:text-brand-700">{p.name}</h2>
              {p.name !== p.brand_name && <p className="text-sm text-ink-600">{p.brand_name}</p>}
              <div className="mt-4 flex gap-4 text-xs text-ink-500">
                <span>{p.documents[0]?.count ?? 0} docs</span>
                <span>{p.content_drafts[0]?.count ?? 0} drafts</span>
                <span>{p.feedback_logs[0]?.count ?? 0} feedback</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
