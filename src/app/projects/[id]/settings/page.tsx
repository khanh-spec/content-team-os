import { ProjectForm } from "@/components/project-form";
import { DeleteProject } from "@/components/delete-project";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";

export default async function SettingsPage({ params }: PageProps<"/projects/[id]/settings">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("*").eq("id", id).single();
  return (
    <div className="max-w-4xl space-y-8">
      <ProjectForm project={data as Project} />
      <DeleteProject projectId={id} />
    </div>
  );
}
