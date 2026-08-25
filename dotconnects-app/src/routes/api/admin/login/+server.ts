import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { createAdminSession } from "$lib/server/admin-session";
import { getSupabaseAdmin } from "$lib/server/supabase-admin";
import { verifyPassword } from "$lib/server/password";
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from "$lib/server/rate-limit";
import { env } from "$env/dynamic/private";

export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json().catch(() => ({}));
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  if (!username || !password) {
    return json({ ok: false, error: "Username and password are required" }, { status: 400 });
  }

  // Keyed on the username, so failed attempts against one account can't
  // lock out another.
  const limitKey = `login:${username.toLowerCase()}`;
  const limit = checkRateLimit(limitKey);
  if (limit.limited) {
    return json(
      { ok: false, error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const supabase = getSupabaseAdmin();

  // Dev fallback only when Supabase isn't configured at all. Once it is,
  // these env vars are inert and auth goes through admin_users.
  if (!supabase) {
    const ok =
      !!env.ADMIN_USERNAME &&
      username === env.ADMIN_USERNAME &&
      password === env.ADMIN_PASSWORD;
    if (ok) { createAdminSession(cookies, username); clearRateLimit(limitKey); }
    else recordFailedAttempt(limitKey);
    return json({ ok, error: ok ? null : "Invalid username or password" });
  }

  const { data } = await supabase
    .from("admin_users")
    .select("username, password_hash, is_active")
    .eq("username", username)
    .maybeSingle();

  // Same generic message whether the user doesn't exist, is deactivated,
  // or the password is wrong — a distinct message tells an attacker which
  // usernames are real.
  if (!data || data.is_active === false || !verifyPassword(password, data.password_hash)) {
    recordFailedAttempt(limitKey);
    return json({ ok: false, error: "Invalid username or password" });
  }

  createAdminSession(cookies, data.username);
  clearRateLimit(limitKey);
  return json({ ok: true });
};
