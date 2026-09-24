"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/fetcher";
import { Button, Card } from "@/components/ui";

export function DeleteProject({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Card className="border-red-500/30">
      <h3 className="font-semibold text-red-300">Delete project</h3>
      <p className="mb-3 text-sm text-ink-600">Removes all documents, files, feedback, drafts and research for this project.</p>
      <Button
        variant="danger"
        disabled={busy}
        onClick={async () => {
          if (!confirm("Delete this project and everything in it? This cannot be undone.")) return;
          setBusy(true);
          try {
            await api(`/api/projects/${projectId}`, "DELETE");
            router.push("/");
          } catch (e) {
            alert((e as Error).message);
            setBusy(false);
          }
        }}
      >
        Delete project
      </Button>
    </Card>
  );
}
