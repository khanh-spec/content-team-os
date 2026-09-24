import { Opportunities } from "@/components/opportunities";
import { SectionTitle } from "@/components/ui";
import { classify, type GscRow } from "@/lib/gsc/opportunities";
import type { OpportunityReport } from "@/lib/gsc/report";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";

export default async function OpportunitiesPage({ params }: PageProps<"/projects/[id]/opportunities">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: project }, { data: rows }, { data: report }, { data: conn }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase.from("gsc_queries").select("query, page, clicks, impressions, ctr, position, period_label, imported_at").eq("project_id", id).limit(5000),
    supabase.from("opportunity_reports").select("id, report, created_at").eq("project_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("gsc_connections").select("status, site_url, last_synced_at").eq("project_id", id).maybeSingle(),
  ]);
  const opportunities = classify((rows ?? []) as GscRow[], project as Project);

  return (
    <div>
      <SectionTitle
        title="Content Opportunities"
        description="Search Console queries sorted into the 3C framework (Company, Customers, Competitors) and turned into brand-specific briefs."
      />
      <Opportunities
        projectId={id}
        opportunities={opportunities}
        importedAt={rows?.[0]?.imported_at ?? null}
        periodLabel={rows?.[0]?.period_label ?? null}
        report={report ? { created_at: report.created_at, report: report.report as OpportunityReport } : null}
        gscStatus={conn?.status ?? "not_connected"}
      />
    </div>
  );
}
