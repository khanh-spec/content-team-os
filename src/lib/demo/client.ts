// A tiny read-only stand-in for the Supabase client, used in preview mode
// (no Supabase configured). It supports the query-builder calls this app
// makes and serves the sample workspace from fixtures.ts. Writes fail with a
// friendly message so the UI shows what would happen.

import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_USER, FIXTURES } from "@/lib/demo/fixtures";

export const PREVIEW_MESSAGE = "Preview mode: connect Supabase to save changes. This sample workspace is read-only.";

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { message: string } | null; count?: number | null };

const previewError = { message: PREVIEW_MESSAGE };

class Query implements PromiseLike<Result> {
  private filters: ((r: Row) => boolean)[] = [];
  private sort: { col: string; asc: boolean }[] = [];
  private max: number | null = null;
  private mode: "many" | "single" | "maybe" = "many";
  private columns = "*";
  private countOnly = false;
  private write = false;

  constructor(private table: string) {}

  select(columns = "*", opts?: { count?: string; head?: boolean }) {
    this.columns = columns;
    if (opts?.head) this.countOnly = true;
    return this;
  }
  insert() { this.write = true; return this; }
  update() { this.write = true; return this; }
  upsert() { this.write = true; return this; }
  delete() { this.write = true; return this; }
  eq(col: string, v: unknown) { this.filters.push((r) => String(r[col]) === String(v)); return this; }
  neq(col: string, v: unknown) { this.filters.push((r) => String(r[col]) !== String(v)); return this; }
  in(col: string, vs: unknown[]) { this.filters.push((r) => vs.map(String).includes(String(r[col]))); return this; }
  or(expr: string) {
    const conds = expr.split(",").map((c) => c.split("."));
    this.filters.push((r) => conds.some(([col, , v]) => String(r[col]) === v));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) { this.sort.push({ col, asc: opts?.ascending ?? true }); return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  private run(): Result {
    if (this.write) return { data: null, error: previewError };
    let rows = (FIXTURES[this.table] ?? []).filter((r) => this.filters.every((f) => f(r)));
    if (this.countOnly) return { data: null, error: null, count: rows.length };
    for (const { col, asc } of [...this.sort].reverse()) {
      rows = [...rows].sort((a, b) => {
        const x = a[col] as string | number;
        const y = b[col] as string | number;
        return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1);
      });
    }
    if (this.max != null) rows = rows.slice(0, this.max);
    // Embedded counts such as "documents(count)".
    const relations = [...this.columns.matchAll(/(\w+)\(count\)/g)].map((m) => m[1]);
    if (relations.length) {
      rows = rows.map((r) => {
        const extra: Row = {};
        for (const rel of relations) extra[rel] = [{ count: (FIXTURES[rel] ?? []).filter((x) => x.project_id === r.id).length }];
        return { ...r, ...extra };
      });
    }
    if (this.mode === "many") return { data: rows, error: null, count: rows.length };
    if (!rows.length) return { data: null, error: this.mode === "single" ? { message: "Not found" } : null };
    return { data: rows[0], error: null };
  }

  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve(this.run()).then(ok, fail);
  }
}

const bucket = {
  list: async () => ({ data: [], error: null }),
  remove: async () => ({ data: null, error: null }),
  upload: async () => ({ data: null, error: previewError }),
  download: async () => ({ data: null, error: previewError }),
  createSignedUrl: async () => ({ data: null, error: previewError }),
};

export function createPreviewClient(): SupabaseClient {
  const client = {
    from: (table: string) => new Query(table),
    rpc: async () => ({ data: null, error: previewError }),
    storage: { from: () => bucket },
    auth: {
      getUser: async () => ({ data: { user: DEMO_USER }, error: null }),
      getClaims: async () => ({ data: { claims: { sub: DEMO_USER.id, email: DEMO_USER.email } }, error: null }),
      signOut: async () => ({ error: null }),
      signInWithOtp: async () => ({ data: null, error: previewError }),
      exchangeCodeForSession: async () => ({ data: null, error: previewError }),
      verifyOtp: async () => ({ data: null, error: previewError }),
    },
  };
  return client as unknown as SupabaseClient;
}
