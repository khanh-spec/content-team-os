"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/fetcher";
import type { Competitor, Project } from "@/lib/types";
import { Button, Card, ErrorNote, Field, Input, Select, Spinner, Textarea } from "@/components/ui";

type FormState = Omit<Project, "id" | "created_at" | "updated_at" | "brand_aliases" | "latitude" | "longitude"> & {
  brand_aliases: string;
  latitude: string;
  longitude: string;
};

const empty: FormState = {
  name: "",
  brand_name: "",
  brand_aliases: "",
  website: "",
  industry: "Hospitality",
  property_type: "",
  city: "",
  region: "",
  country: "",
  country_code: "",
  language: "en",
  serp_location: "",
  latitude: "",
  longitude: "",
  brand_summary: "",
  usps: "",
  brand_facts: "",
  tone_of_voice: "",
  words_to_use: "",
  words_to_avoid: "",
  target_customers: "",
  competitors: [],
  notes: "",
  products: "",
  restricted_claims: "",
  english_variant: "British English",
  sentence_style: "",
  cta_preference: "",
  site_pages: [],
};

function toForm(p?: Project): FormState {
  if (!p) return empty;
  const f = { ...empty } as Record<string, unknown>;
  for (const k of Object.keys(empty)) f[k] = (p as Record<string, unknown>)[k] ?? (empty as Record<string, unknown>)[k];
  return {
    ...(f as FormState),
    brand_aliases: p.brand_aliases.join(", "),
    latitude: p.latitude?.toString() ?? "",
    longitude: p.longitude?.toString() ?? "",
    competitors: p.competitors ?? [],
    site_pages: p.site_pages ?? [],
  };
}

export function ProjectForm({ project, aiEnabled = false }: { project?: Project; aiEnabled?: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toForm(project));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  };
  const bind = (key: keyof FormState) => ({
    value: (form[key] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, e.target.value as never),
  });

  const setCompetitor = (i: number, patch: Partial<Competitor>) =>
    set("competitors", form.competitors.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const coord = (v: string) => (v.trim() ? Number(v) : null);
    const body = {
      ...form,
      brand_aliases: form.brand_aliases.split(",").map((s) => s.trim()).filter(Boolean),
      latitude: coord(form.latitude),
      longitude: coord(form.longitude),
      competitors: form.competitors.filter((c) => c.name.trim()),
      site_pages: form.site_pages.filter((p) => p.title.trim() && p.url.trim()),
    };
    try {
      if (project) {
        await api(`/api/projects/${project.id}`, "PATCH", body);
        setSaved(true);
        router.refresh();
      } else {
        const { id } = await api<{ id: string }>("/api/projects", "POST", body);
        router.push(`/projects/${id}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card className="space-y-4">
        <h3 className="font-semibold">Project</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project name *">
            <Input required {...bind("name")} placeholder="Anio Boutique Hotel – 2026 SEO" />
          </Field>
          <Field label="Official brand name *" hint="Exact spelling used for fact-checking">
            <Input required {...bind("brand_name")} placeholder="Anio Boutique Hotel Hoi An" />
          </Field>
          <Field label="Accepted name variants" hint="Comma separated, e.g. short names">
            <Input {...bind("brand_aliases")} placeholder="Anio Hotel, Anio Hoi An" />
          </Field>
          <Field label="Website">
            <Input {...bind("website")} placeholder="https://…" />
          </Field>
          <Field label="Industry">
            <Input {...bind("industry")} />
          </Field>
          <Field label="Property / business type">
            <Input {...bind("property_type")} placeholder="Boutique hotel, beach resort, restaurant…" />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <h3 className="font-semibold">Local market</h3>
          <p className="text-sm text-ink-500">Used to localize SerpApi, Google Maps and ChatGPT web searches.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="City">
            <Input {...bind("city")} placeholder="Hoi An" />
          </Field>
          <Field label="Region / province">
            <Input {...bind("region")} placeholder="Quang Nam" />
          </Field>
          <Field label="Country">
            <Input {...bind("country")} placeholder="Vietnam" />
          </Field>
          <Field label="Country code (ISO-2)">
            <Input {...bind("country_code")} maxLength={2} placeholder="vn" />
          </Field>
          <Field label="Search language">
            <Input {...bind("language")} placeholder="en" />
          </Field>
          <Field label="SerpApi location" hint={<a className="underline" href="https://serpapi.com/locations-api" target="_blank" rel="noreferrer">Canonical name</a>}>
            <Input {...bind("serp_location")} placeholder="Hoi An, Quang Nam Province, Vietnam" />
          </Field>
          <Field label="Latitude" hint="Optional, centres Google Maps">
            <Input {...bind("latitude")} inputMode="decimal" placeholder="15.8801" />
          </Field>
          <Field label="Longitude">
            <Input {...bind("longitude")} inputMode="decimal" placeholder="108.3380" />
          </Field>
        </div>
      </Card>

      {project && <ExtractPanel projectId={project.id} aiEnabled={aiEnabled} onApply={(field, value) => set(field as keyof FormState, value as never)} current={form} />}

      <Card className="space-y-4">
        <div>
          <h3 className="font-semibold">Company</h3>
          <p className="text-sm text-ink-500">Who the brand is and what it sells.</p>
        </div>
        <Field label="Brand summary">
          <Textarea {...bind("brand_summary")} rows={3} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Products & services" hint="Rooms, restaurants, spa, events… one per line">
            <Textarea {...bind("products")} rows={4} />
          </Field>
          <Field label="Unique selling points" hint="One per line">
            <Textarea {...bind("usps")} rows={4} placeholder={"Green Island location\nFrench-inspired hospitality"} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <h3 className="font-semibold">Brand rules</h3>
          <p className="text-sm text-ink-500">The source of truth every draft is checked against.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="✓ Approved facts" hint="Room count, address, distances, awards, amenities: one per line.">
            <Textarea {...bind("brand_facts")} rows={7} placeholder={"512 rooms\nLocated at 317 Outram Road\n3 minutes from Havelock MRT"} />
          </Field>
          <Field label="❌ Restricted claims" hint="Claims the brand must never make: one per line.">
            <Textarea {...bind("restricted_claims")} rows={7} placeholder={"Cannot claim Michelin-starred\nCannot claim private beach\nCannot mention unavailable facilities"} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <h3 className="font-semibold">Brand voice profile</h3>
          <p className="text-sm text-ink-500">How the brand sounds: used by the checker and the AI writer.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="English">
            <Select value={form.english_variant} onChange={(e) => set("english_variant", e.target.value)}>
              {["British English", "American English", "Australian English"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tone">
            <Input {...bind("tone_of_voice")} placeholder="Premium but approachable" />
          </Field>
          <Field label="CTA preference">
            <Input {...bind("cta_preference")} placeholder="Check availability" />
          </Field>
        </div>
        <Field label="Sentence style">
          <Input {...bind("sentence_style")} placeholder="Short sentences, second person, no exclamation marks" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preferred vocabulary" hint="Comma or line separated">
            <Textarea {...bind("words_to_use")} rows={3} placeholder="thoughtfully designed, local experience, personalised service" />
          </Field>
          <Field label="Avoid" hint="Comma or line separated">
            <Textarea {...bind("words_to_avoid")} rows={3} placeholder="world-class, hidden gem, unforgettable" />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Site pages</h3>
            <p className="text-sm text-ink-500">Used for internal-link suggestions and link checks.</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => set("site_pages", [...form.site_pages, { title: "", url: "", type: "" }])}>
            Add page
          </Button>
        </div>
        {form.site_pages.map((pg, i) => (
          <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1.4fr_0.8fr_auto]">
            <Input placeholder="Rooms & Suites" value={pg.title} onChange={(e) => set("site_pages", form.site_pages.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            <Input placeholder="https://…/rooms" value={pg.url} onChange={(e) => set("site_pages", form.site_pages.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
            <Input placeholder="Type (rooms, dining…)" value={pg.type ?? ""} onChange={(e) => set("site_pages", form.site_pages.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))} />
            <Button type="button" variant="ghost" size="sm" onClick={() => set("site_pages", form.site_pages.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </div>
        ))}
        {form.site_pages.length === 0 && <p className="text-sm text-ink-500">No pages yet.</p>}
      </Card>

      <Card className="space-y-4">
        <h3 className="font-semibold">Customers</h3>
        <Field label="Target guests / audiences" hint="Segments, source markets, trip types, what they care about">
          <Textarea {...bind("target_customers")} rows={4} />
        </Field>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Competitors</h3>
            <p className="text-sm text-ink-500">Exact names are used to catch misspellings and to track AI visibility.</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => set("competitors", [...form.competitors, { name: "", website: "" }])}>
            Add competitor
          </Button>
        </div>
        {form.competitors.map((c, i) => (
          <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Input placeholder="Official name" value={c.name} onChange={(e) => setCompetitor(i, { name: e.target.value })} />
            <Input placeholder="Website" value={c.website ?? ""} onChange={(e) => setCompetitor(i, { website: e.target.value })} />
            <Input
              placeholder="Variants (comma separated)"
              value={(c.aliases ?? []).join(", ")}
              onChange={(e) => setCompetitor(i, { aliases: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => set("competitors", form.competitors.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </div>
        ))}
        {form.competitors.length === 0 && <p className="text-sm text-ink-500">No competitors yet.</p>}
      </Card>

      <Card>
        <Field label="Other notes">
          <Textarea {...bind("notes")} rows={3} />
        </Field>
      </Card>

      <ErrorNote>{error}</ErrorNote>
      <div className="flex items-center gap-3">
        <Button disabled={saving}>{saving ? "Saving…" : project ? "Save profile" : "Create project"}</Button>
        {saved && <span className="text-sm text-emerald-400">Saved</span>}
      </div>
    </form>
  );
}

type Suggestions = Partial<Record<"brand_summary" | "products" | "usps" | "brand_facts" | "restricted_claims" | "tone_of_voice" | "sentence_style" | "words_to_use" | "words_to_avoid" | "cta_preference" | "target_customers", string>>;

const LABELS: Record<keyof Suggestions, string> = {
  brand_summary: "Brand summary",
  products: "Products & services",
  usps: "USPs",
  brand_facts: "Approved facts",
  restricted_claims: "Restricted claims",
  tone_of_voice: "Tone",
  sentence_style: "Sentence style",
  words_to_use: "Preferred vocabulary",
  words_to_avoid: "Avoid",
  cta_preference: "CTA preference",
  target_customers: "Target audiences",
};

function ExtractPanel({ projectId, aiEnabled, onApply, current }: { projectId: string; aiEnabled: boolean; onApply: (field: string, value: string) => void; current: Record<string, unknown> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [applied, setApplied] = useState<string[]>([]);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ suggestions: Suggestions }>(`/api/projects/${projectId}/extract`, "POST");
      setSuggestions(res.suggestions);
      setApplied([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3 border-brand-300 bg-brand-50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Extract from brand documents</h3>
          <p className="text-sm text-ink-500">
            {aiEnabled ? "AI reads the Brand Library and proposes company info, approved facts, restricted claims and voice rules. Review and apply what's right." : "Needs AI Enhanced mode. In Free mode, fill the fields below by hand."}
          </p>
        </div>
        <Button type="button" variant="secondary" disabled={!aiEnabled || busy} onClick={run}>
          {busy ? (
            <>
              <Spinner /> Reading documents…
            </>
          ) : (
            "Extract with AI"
          )}
        </Button>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {suggestions && (
        <ul className="space-y-3">
          {(Object.keys(LABELS) as (keyof Suggestions)[])
            .filter((k) => suggestions[k]?.trim())
            .map((k) => {
              const existing = String(current[k] ?? "").trim();
              const merged = existing ? `${existing}\n${suggestions[k]}` : suggestions[k]!;
              return (
                <li key={k} className="rounded-lg border border-ink-200 bg-surface p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">{LABELS[k]}</span>
                    <span className="flex gap-1">
                      <Button type="button" size="sm" variant="ghost" disabled={applied.includes(k)} onClick={() => (onApply(k, suggestions[k]!), setApplied([...applied, k]))}>
                        Replace
                      </Button>
                      {existing && ["brand_facts", "restricted_claims", "usps", "products", "words_to_use", "words_to_avoid"].includes(k) && (
                        <Button type="button" size="sm" variant="secondary" disabled={applied.includes(k)} onClick={() => (onApply(k, merged), setApplied([...applied, k]))}>
                          Append
                        </Button>
                      )}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-ink-600">{suggestions[k]}</p>
                </li>
              );
            })}
          <p className="text-xs text-ink-500">Applied suggestions go into the form below. Click “Save profile” to keep them.</p>
        </ul>
      )}
    </Card>
  );
}
