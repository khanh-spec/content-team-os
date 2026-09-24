"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/fetcher";
import { Button } from "@/components/ui";

export function DeleteRun({ projectId, runId, back }: { projectId: string; runId: string; back: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      className="text-red-300"
      onClick={async () => {
        if (!confirm("Delete this run?")) return;
        await api(`/api/projects/${projectId}/runs/${runId}`, "DELETE").catch((e) => alert(e.message));
        router.push(back);
        router.refresh();
      }}
    >
      Delete
    </Button>
  );
}
