"use client";

export async function api<T = { ok: boolean }>(path: string, method = "POST", body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const issues = Array.isArray(json.issues)
      ? `: ${json.issues.map((i: { path: string[]; message: string }) => `${i.path.join(".")} ${i.message}`).join("; ")}`
      : "";
    throw new Error((json.error ?? `Request failed (${res.status})`) + issues);
  }
  return json as T;
}
