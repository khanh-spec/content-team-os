import "server-only";

import OpenAI from "openai";
import { MODELS, requireEnv } from "@/lib/env";

let client: OpenAI | null = null;

export function openai(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  return client;
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  // The embeddings endpoint accepts batches; keep them modest.
  for (let i = 0; i < texts.length; i += 96) {
    const batch = texts.slice(i, i + 96).map((t) => t.slice(0, 8000));
    const res = await openai().embeddings.create({ model: MODELS.embedding, input: batch });
    out.push(...res.data.map((d) => d.embedding));
  }
  return out;
}

/** Run async tasks with a concurrency cap, preserving order. */
export async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
