import { SettingsForm } from "@/components/settings-form";
import { MODEL_OPTIONS, loadAiSettings } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { key: _key, ...settings } = await loadAiSettings(supabase);
  void _key;
  return (
    <div className="max-w-3xl px-4 py-6 sm:px-8">
      <h1 className="text-xl font-semibold">Settings</h1>
      <p className="mb-6 text-sm text-ink-500">Choose how the workspace thinks. SerpApi research works in both modes.</p>
      <SettingsForm settings={settings} models={MODEL_OPTIONS.map((m) => ({ ...m }))} serpConfigured={!!process.env.SERPAPI_API_KEY} />
    </div>
  );
}
