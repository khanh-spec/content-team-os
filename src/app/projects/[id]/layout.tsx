import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectLayout({ children, params }: LayoutProps<"/projects/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("id, name, brand_name, city, country, property_type").eq("id", id).maybeSingle();
  if (!project) notFound();

  return (
    <div className="px-4 py-6 sm:px-8">
      <div className="mb-6">
        <p className="font-mono text-xs text-ink-500">
          {[project.property_type, [project.city, project.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "hospitality"}
        </p>
        <h1 className="mt-0.5 text-xl font-semibold">{project.name}</h1>
      </div>
      {children}
    </div>
  );
}
