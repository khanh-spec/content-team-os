"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/fetcher";
import { Button, Spinner } from "@/components/ui";

export function FinalizeButton({ projectId, runId, label }: { projectId: string; runId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await api(`/api/projects/${projectId}/visibility/${runId}/finalize`, "POST").catch((e) => alert(e.message));
        setBusy(false);
        router.refresh();
      }}
    >
      {busy && <Spinner />} {label}
    </Button>
  );
}
