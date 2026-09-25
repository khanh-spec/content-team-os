import { z } from "zod";
import { HttpError, handle, parseBody } from "@/lib/api";
import { isEmailAllowed } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({ email: z.string().trim().email() });

/**
 * Sends the magic sign-in link from the server, so the browser never needs the
 * Supabase URL or key. The PKCE verifier is stored in a cookie by the server
 * client and picked up again by /auth/callback.
 */
export const POST = handle(async (req: Request) => {
  const { email } = await parseBody(req, Body);
  if (!isEmailAllowed(email)) throw new HttpError(403, "This email domain is not allowed to sign in.");
  const supabase = await createClient();
  const origin = new URL(req.url).origin;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) throw new HttpError(400, error.message);
  return { ok: true };
});
