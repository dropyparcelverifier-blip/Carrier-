import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const COOKIE_NAME = "dropy_admin_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

export type AdminRole = "admin" | "staff";

export type AdminIdentity = {
  id: string | null; // null for the env-var dev fallback (no DB row exists)
  username: string;
  role: AdminRole;
};

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) {
    throw new Error(
      "ADMIN_SESSION_SECRET is not set — required to sign admin session cookies.",
    );
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/** Issues a signed, httpOnly session cookie for the given admin username. */
export async function createAdminSession(username: string): Promise<void> {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${username}.${expires}`;
  const token = `${payload}.${sign(payload)}`;
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/**
 * Validates the session cookie and returns the username, or null.
 *
 * Deliberately does NOT hit the database — the cookie signature alone
 * proves the session. Use requireAdminIdentity() when the role or the
 * user's id is needed (audit rows, permission checks).
 */
export async function requireAdminSession(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [username, expiresStr, signature] = parts;
  const payload = `${username}.${expiresStr}`;
  const expected = sign(payload);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || Date.now() > expires) return null;

  return username;
}

/**
 * Full identity — id, username and role — for routes that need to write
 * an audit row or check a permission.
 *
 * Role is read from admin_users on each call rather than baked into the
 * cookie. That costs one query, but it means demoting or deactivating
 * someone takes effect immediately instead of waiting up to 8 hours for
 * their session to expire. For a revocation path, "immediately" is the
 * only correct answer.
 *
 * Falls back to role "admin" only when Supabase isn't configured at all
 * (the dev env-var login path) — there is no admin_users table to read
 * in that case, and that path is already dev-only.
 */
export async function requireAdminIdentity(): Promise<AdminIdentity | null> {
  const username = await requireAdminSession();
  if (!username) return null;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    // Dev fallback: no database, so no role table.
    return { id: null, username, role: "admin" };
  }

  const { data, error } = await supabase
    .from("admin_users")
    .select("id, username, role, is_active")
    .eq("username", username)
    .maybeSingle();

  // A valid cookie for a user who has since been deleted or deactivated
  // must not authenticate. Fail closed.
  if (error || !data || data.is_active === false) return null;

  const role: AdminRole = data.role === "admin" ? "admin" : "staff";
  return { id: data.id, username: data.username, role };
}

/**
 * Guard for role-gated routes. Returns the identity when the caller has
 * the required role, or null when they do not (or aren't logged in).
 */
export async function requireAdminRole(
  required: AdminRole,
): Promise<AdminIdentity | null> {
  const identity = await requireAdminIdentity();
  if (!identity) return null;
  if (required === "admin" && identity.role !== "admin") return null;
  return identity;
}
