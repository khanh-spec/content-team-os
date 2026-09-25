import { KnowledgeScoreCard } from "@/components/knowledge-score";
import { DeleteProject } from "@/components/delete-project";
import { ProjectForm } from "@/components/project-form";
import { SectionTitle } from "@/components/ui";
import { getAI } from "@/lib/ai";
import { knowledgeScore } from "@/lib/intel/knowledge";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";

export default async function BrandIntelligencePage({ params }: PageProps<"/projects/[id]/settings">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, docs, rules, research, ai] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("project_id", id),
    supabase.from("feedback_logs").select("id", { count: "exact", head: true }).eq("project_id", id).eq("apply_as_rule", true),
    supabase.from("research_runs").select("id", { count: "exact", head: true }).eq("project_id", id),
    getAI(supabase),
  ]);
  const project = data as Project;
  const ks = knowledgeScore(project, { documents: docs.count ?? 0, rules: rules.count ?? 0, research: research.count ?? 0 });
  return (
    <div className="space-y-6">
      <SectionTitle title="Brand Intelligence" description="Company information, approved facts, restricted claims and brand voice: the knowledge every check and rewrite relies on." />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="max-w-4xl space-y-8">
          <ProjectForm project={project} aiEnabled={!!ai} />
          <DeleteProject projectId={id} />
        </div>
        <div className="xl:sticky xl:top-6 xl:h-fit">
          <KnowledgeScoreCard score={ks.score} items={ks.items} />
        </div>
      </div>
    </div>
  );
}
