"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AiSettings } from "@/lib/ai";
import { api } from "@/lib/fetcher";
import { Badge, Button, Card, ErrorNote, Field, Input, Select, cn } from "@/components/ui";

const FREE = ["Search analysis (intent, entities, SERP features)", "Competitor comparison & content gaps", "Customer questions from PAA, Reddit, forums, reviews", "Rule-based SEO, GEO and brand-compliance checks", "Template-based briefs and recommendations"];
const AI = ["Everything in Free mode", "Semantic research synthesis", "Brand-voice rewriting & draft generation", "Rule extraction from documents and feedback", "ChatGPT visibility checks"];

export function SettingsForm({ settings, models, serpConfigured }: { settings: AiSettings; models: { value: string; label: string }[]; serpConfigured: boolean }) {
  const router = useRouter();
  const known = models.some((m) => m.value === settings.model);
  const [enabled, setEnabled] = useState(settings.enabled);
  const [model, setModel] = useState(known ? settings.model : "custom");
  const [custom, setCustom] = useState(known ? "" : settings.model);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(extra: { clearKey?: boolean } = {}) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api("/api/settings", "PUT", { enabled, model: model === "custom" ? custom : model, apiKey: apiKey || undefined, ...extra });
      setApiKey("");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const noKey = enabled && settings.keySource === "none" && !apiKey;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { on: false, title: "Free Intelligence", sub: "SerpApi + rules engine", items: FREE },
          { on: true, title: "AI Enhanced", sub: "SerpApi + OpenAI", items: AI },
        ].map((m) => (
          <button
            key={m.title}
            onClick={() => setEnabled(m.on)}
            className={cn("rounded-xl border p-5 text-left transition", enabled === m.on ? "border-brand-500 bg-brand-50" : "border-ink-200 bg-surface hover:border-ink-300")}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold">{m.title}</p>
              {enabled === m.on && <Badge tone="brand">Active</Badge>}
            </div>
            <p className="font-mono text-xs text-ink-500">{m.sub}</p>
            <ul className="mt-3 space-y-1 text-sm text-ink-600">
              {m.items.map((i) => (
                <li key={i}>✓ {i}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      <Card className={cn("space-y-4", !enabled && "opacity-60")}>
        <h3 className="font-semibold">OpenAI</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Model">
            <Select value={model} onChange={(e) => setModel(e.target.value)} disabled={!enabled}>
              {models.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
              <option value="custom">Custom…</option>
            </Select>
          </Field>
          {model === "custom" && (
            <Field label="Custom model ID">
              <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. gpt-5.5-mini" disabled={!enabled} />
            </Field>
          )}
        </div>
        <Field
          label="API key"
          hint={
            settings.keySource === "workspace"
              ? "A workspace key is saved (encrypted). Enter a new one to replace it."
              : settings.keySource === "environment"
                ? "Using the key configured on the server. Enter one here to override it."
                : "No key found. Add one here or set OPENAI_API_KEY on the server."
          }
        >
          <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={settings.keySource === "none" ? "sk-…" : "••••••••••••"} disabled={!enabled || !settings.canStoreKey} autoComplete="off" />
        </Field>
        {!settings.canStoreKey && <p className="text-xs text-ink-500">Saving a key here needs Supabase with SUPABASE_SERVICE_ROLE_KEY. Until then the server key is used.</p>}
        {settings.keySource === "workspace" && (
          <Button variant="ghost" size="sm" onClick={() => save({ clearKey: true })} disabled={busy}>
            Remove saved key
          </Button>
        )}
      </Card>

      <Card className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">SerpApi</h3>
          <p className="text-sm text-ink-500">Used for all research in both modes. Set SERPAPI_API_KEY on the server.</p>
        </div>
        <Badge tone={serpConfigured ? "green" : "red"}>{serpConfigured ? "Connected" : "Missing key"}</Badge>
      </Card>

      {noKey && <p className="text-sm text-amber-300">AI Enhanced mode is selected but no API key is available, so the workspace will run in Free mode.</p>}
      <ErrorNote>{error}</ErrorNote>
      <div className="flex items-center gap-3">
        <Button onClick={() => save()} disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </Button>
        {saved && <span className="text-sm text-emerald-400">Saved</span>}
      </div>
    </div>
  );
}
