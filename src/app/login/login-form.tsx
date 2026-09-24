"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, ErrorNote, Field, Input } from "@/components/ui";

export function LoginForm({ initialError }: { initialError: string | null }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(initialError);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setState("idle");
    } else setState("sent");
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-lg bg-brand-700 font-bold text-white">HP</span>
          <h1 className="mt-3 text-xl font-semibold">SEO/GEO Brand Manager</h1>
          <p className="text-sm text-ink-500">Heads on Pillows content team</p>
        </div>
        <div className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm">
          {state === "sent" ? (
            <p className="text-sm text-ink-700">
              Check <strong>{email}</strong> for a sign-in link.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Field label="Work email">
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@headsonpillows.com" autoFocus />
              </Field>
              <ErrorNote>{error}</ErrorNote>
              <Button className="w-full" disabled={state === "sending"}>
                {state === "sending" ? "Sending…" : "Email me a sign-in link"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
