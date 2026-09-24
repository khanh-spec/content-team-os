import { notFound } from "next/navigation";
import { ProjectTabs } from "@/components/project-tabs";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectLayout({ children, params }: LayoutProps<"/projects/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("id, name, brand_name, city, country, property_type").eq("id", id).maybeSingle();
  if (!project) notFound();

  return (
    <div>
      <div className="border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
            {[project.property_type, [project.city, project.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "Hospitality"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{project.name}</h1>
          <div className="mt-4">
            <ProjectTabs projectId={id} />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
