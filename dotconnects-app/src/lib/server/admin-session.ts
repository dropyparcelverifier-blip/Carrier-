import { createHmac, timingSafeEqual } from "node:crypto";
import type { Cookies } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { getSupabaseAdmin } from "$lib/server/supabase-admin";

/**
 * Admin session — ported from the Next.js version.
 *
 * The ONE file that needed a real rewrite rather than a path fix. Next
 * read cookies from an ambient `cookies()` call available anywhere in a
 * server component; SvelteKit passes a `Cookies` object explicitly on the
 * request event.
 *
 * That's a better shape: the dependency is visible in the signature
 * instead of being ambient, so a function that touches the session can't
 * pretend it doesn't.
 */

const COOKIE_NAME = "dot_admin_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

export type AdminRole = "admin" | "staff";

export type AdminIdentity = {
  id: string | null;
  username: string;
  role: AdminRole;
};

function secret(): string {
  const s = env.ADMIN_SESSION_SECRET;
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

export function createAdminSession(cookies: Cookies, username: string): void {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${username}.${expires}`;
  cookies.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearAdminSession(cookies: Cookies): void {
  cookies.delete(COOKIE_NAME, { path: "/" });
}

/** Validates the cookie signature. Does not hit the database. */
export function readAdminSession(cookies: Cookies): string | null {
  const token = cookies.get(COOKIE_NAME);
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [username, expiresStr, signature] = parts;
  const expected = sign(`${username}.${expiresStr}`);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || Date.now() > expires) return null;

  return username;
}

/**
 * Full identity including role.
 *
 * Role is read from admin_users on every call rather than baked into the
 * cookie: a cookie-baked role would keep working for up to 8 hours after
 * someone is demoted or deactivated. For a revocation path, immediately
 * is the only correct answer.
 */
export async function requireAdminIdentity(cookies: Cookies): Promise<AdminIdentity | null> {
  const username = readAdminSession(cookies);
  if (!username) return null;

  const supabase = getSupabaseAdmin();
  if (!supabase) return { id: null, username, role: "admin" }; // dev fallback

  const { data, error } = await supabase
    .from("admin_users")
    .select("id, username, role, is_active")
    .eq("username", username)
    .maybeSingle();

  // A valid cookie for a deleted or deactivated user must not
  // authenticate. Fail closed.
  if (error || !data || data.is_active === false) return null;

  return {
    id: data.id,
    username: data.username,
    role: data.role === "admin" ? "admin" : "staff",
  };
}

export async function requireAdminRole(
  cookies: Cookies,
  required: AdminRole,
): Promise<AdminIdentity | null> {
  const identity = await requireAdminIdentity(cookies);
  if (!identity) return null;
  if (required === "admin" && identity.role !== "admin") return null;
  return identity;
}
