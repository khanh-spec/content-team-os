"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/fetcher";
import { createClient } from "@/lib/supabase/client";
import { DOCUMENT_CATEGORIES, type DocumentRow } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Select, Spinner, Textarea, cn, formatDate } from "@/components/ui";

const ACCEPT = ".pdf,.docx,.pptx,.xlsx,.md,.markdown,.txt,.csv,.html,.htm,.json";
const categoryLabel = (v: string) => DOCUMENT_CATEGORIES.find((c) => c.value === v)?.label ?? v;

function guessCategory(name: string) {
  const n = name.toLowerCase();
  if (/guideline|brand ?book|brand ?guide/.test(n)) return "brand_guideline";
  if (/fact|spec|amenit|room/.test(n)) return "fact_sheet";
  if (/tone|voice|style/.test(n)) return "tone_reference";
  if (/brief|requirement|scope/.test(n)) return "requirement";
  if (/competitor/.test(n)) return "competitor";
  return "other";
}

export function DocumentList({ projectId, documents }: { projectId: string; documents: DocumentRow[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [queue, setQueue] = useState<{ name: string; state: "uploading" | "indexing" | "done" | "error"; error?: string }[]>([]);
  const [category, setCategory] = useState("auto");
  const [paste, setPaste] = useState({ title: "", category: "fact_sheet", text: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: FileList | File[]) {
    const list = [...files];
    if (!list.length) return;
    setError(null);
    setQueue(list.map((f) => ({ name: f.name, state: "uploading" })));
    const supabase = createClient();
    const update = (i: number, patch: Partial<(typeof queue)[number]>) =>
      setQueue((q) => q.map((item, j) => (j === i ? { ...item, ...patch } : item)));

    await Promise.all(
      list.map(async (file, i) => {
        try {
          const safe = file.name.replace(/[^\w.\-]+/g, "_");
          const path = `${projectId}/${crypto.randomUUID()}-${safe}`;
          const { error } = await supabase.storage.from("brand-files").upload(path, file, { contentType: file.type || undefined });
          if (error) throw new Error(error.message);
          update(i, { state: "indexing" });
          await api(`/api/projects/${projectId}/documents`, "POST", {
            mode: "upload",
            title: file.name.replace(/\.[^.]+$/, ""),
            category: category === "auto" ? guessCategory(file.name) : category,
            storage_path: path,
            filename: file.name,
            mime_type: file.type || null,
            size_bytes: file.size,
          });
          update(i, { state: "done" });
        } catch (e) {
          update(i, { state: "error", error: (e as Error).message });
        }
      }),
    );
    router.refresh();
  }

  async function submitPaste(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/projects/${projectId}/documents`, "POST", { mode: "paste", ...paste });
      setPaste({ title: "", category: paste.category, text: "" });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this document?")) return;
    await api(`/api/projects/${projectId}/documents/${id}`, "DELETE").catch((e) => alert(e.message));
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card className="h-fit space-y-4">
        <div className="flex rounded-lg bg-ink-100 p-1 text-sm">
          {(["upload", "paste"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn("flex-1 rounded-md py-1.5 font-medium", mode === m ? "bg-surface shadow-sm" : "text-ink-500")}
            >
              {m === "upload" ? "Upload files" : "Paste text"}
            </button>
          ))}
        </div>

        {mode === "upload" ? (
          <div className="space-y-3">
            <Field label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="auto">Auto-detect from file name</option>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                uploadFiles(e.dataTransfer.files);
              }}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 text-center text-sm transition",
                dragging ? "border-brand-500 bg-brand-50" : "border-ink-300 hover:border-brand-400",
              )}
            >
              <p className="font-medium text-ink-800">Drop files or click to browse</p>
              <p className="mt-1 text-xs text-ink-500">PDF, DOCX, PPTX, XLSX, MD, TXT, CSV · up to 50 MB</p>
              <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
            </div>
            {queue.length > 0 && (
              <ul className="space-y-1.5 text-sm">
                {queue.map((q, i) => (
                  <li key={i} className="flex items-start justify-between gap-2">
                    <span className="truncate">{q.name}</span>
                    <span className="shrink-0 text-xs">
                      {q.state === "done" ? (
                        <span className="text-emerald-400">Indexed</span>
                      ) : q.state === "error" ? (
                        <span className="text-red-300" title={q.error}>
                          Failed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-ink-500">
                          <Spinner className="h-3 w-3" /> {q.state === "uploading" ? "Uploading" : "Reading & indexing"}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
                {queue.filter((q) => q.error).map((q, i) => (
                  <ErrorNote key={i}>
                    {q.name}: {q.error}
                  </ErrorNote>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <form onSubmit={submitPaste} className="space-y-3">
            <Field label="Title">
              <Input required value={paste.title} onChange={(e) => setPaste({ ...paste, title: e.target.value })} placeholder="Room types & amenities" />
            </Field>
            <Field label="Category">
              <Select value={paste.category} onChange={(e) => setPaste({ ...paste, category: e.target.value })}>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Content" hint="Markdown or plain text">
              <Textarea required rows={10} value={paste.text} onChange={(e) => setPaste({ ...paste, text: e.target.value })} />
            </Field>
            <ErrorNote>{error}</ErrorNote>
            <Button disabled={busy} className="w-full">
              {busy ? "Indexing…" : "Add to library"}
            </Button>
          </form>
        )}
      </Card>

      <div>
        {documents.length === 0 ? (
          <Empty title="No documents yet">Upload brand guidelines, fact sheets or past articles the client approved.</Empty>
        ) : (
          <div className="overflow-hidden rounded-xl border border-ink-200 bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Document</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Added</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {documents.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{d.title}</p>
                      <p className="text-xs text-ink-500">
                        {d.source === "paste" ? "Pasted text" : (d.storage_path?.split(".").pop()?.toUpperCase() ?? "File")}
                        {d.size_bytes ? ` · ${Math.max(1, Math.round(d.size_bytes / 1024))} KB` : ""}
                        {d.status === "processing" && " · indexing…"}
                      </p>
                      {d.status === "error" && <p className="mt-1 text-xs text-red-300">{d.error}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={d.status === "error" ? "red" : "gray"}>{categoryLabel(d.category)}</Badge>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-ink-500 sm:table-cell">{formatDate(d.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {d.storage_path && (
                          <a href={`/api/projects/${projectId}/documents/${d.id}`} target="_blank" rel="noreferrer" className="rounded-md px-2 py-1 text-xs text-ink-600 hover:bg-ink-100">
                            Open
                          </a>
                        )}
                        <button onClick={() => remove(d.id)} className="rounded-md px-2 py-1 text-xs text-red-300 hover:bg-red-500/10">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
