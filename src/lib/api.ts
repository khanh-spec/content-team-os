import "server-only";

import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/env";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || !isEmailAllowed(data.user.email)) {
    throw new HttpError(401, "Unauthorized");
  }
  return { supabase, user: data.user };
}

export type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  return schema.parse(json);
}

/** Wrap a route handler with consistent error → JSON handling. */
export function handle<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      const result = await fn(req, ctx);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "Invalid input", issues: err.issues },
          { status: 400 },
        );
      }
      console.error(err);
      const message = err instanceof Error ? err.message : "Unexpected error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

export function must<R extends { data: unknown; error: { message: string } | null }>(
  res: R,
): NonNullable<R["data"]> {
  if (res.error) throw new HttpError(500, res.error.message);
  if (res.data === null || res.data === undefined) throw new HttpError(404, "Not found");
  return res.data as NonNullable<R["data"]>;
}
