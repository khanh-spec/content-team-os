"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/fetcher";
import type { Competitor, Project } from "@/lib/types";
import { Button, Card, ErrorNote, Field, Input, Textarea } from "@/components/ui";

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
  };
}

export function ProjectForm({ project }: { project?: Project }) {
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

      <Card className="space-y-4">
        <div>
          <h3 className="font-semibold">Company</h3>
          <p className="text-sm text-ink-500">The source of truth the writer checks every draft against.</p>
        </div>
        <Field label="Brand summary">
          <Textarea {...bind("brand_summary")} rows={3} />
        </Field>
        <Field label="USPs">
          <Textarea {...bind("usps")} rows={3} placeholder="One per line" />
        </Field>
        <Field label="Verified brand facts" hint="Room count, distances, opening year, awards, amenities, policies — one per line.">
          <Textarea {...bind("brand_facts")} rows={6} placeholder={"42 rooms and suites\n5-minute walk to the Japanese Covered Bridge\nRooftop pool open 7am–8pm"} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Tone of voice">
            <Textarea {...bind("tone_of_voice")} rows={4} placeholder="Warm, understated, locally knowledgeable…" />
          </Field>
          <Field label="Words to use">
            <Textarea {...bind("words_to_use")} rows={4} />
          </Field>
          <Field label="Words to avoid">
            <Textarea {...bind("words_to_avoid")} rows={4} placeholder="cheap, hidden gem, nestled…" />
          </Field>
        </div>
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
        {saved && <span className="text-sm text-emerald-700">Saved</span>}
      </div>
    </form>
  );
}
