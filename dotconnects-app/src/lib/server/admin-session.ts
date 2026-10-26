import { createHmac, timingSafeEqual } from "node:crypto";
import type { Cookies } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { getSupabaseAdmin } from "$lib/server/supabase-admin";
import { currentHost } from "$lib/server/request-host";
import { brandForHost, isBrandKey, type BrandKey } from "$lib/brands";

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
  /**
   * null = the Dropy team: sees every order, exactly as before brands
   * existed. A brand (e.g. "rudra") sees only that brand's orders and is
   * only ever staff.
   */
  brand?: BrandKey | null;
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
  const hostBrand = brandForHost(currentHost());
  if (!supabase) {
    // dev fallback — never on a brand's host
    return hostBrand ? null : { id: null, username, role: "admin", brand: null };
  }

  const { data, error } = await supabase
    .from("admin_users")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  // A valid cookie for a deleted or deactivated user must not
  // authenticate. Fail closed.
  if (error || !data || data.is_active === false) return null;

  /* A brand login works only on its own admin host, and a Dropy login
     never works there. Checked on every request, not just at login: the
     brand can be changed in the database while a cookie is still live.
     An unknown brand value fails closed. `select *` rather than naming
     the column, so this still answers (as Dropy) on a database where the
     brand column hasn't been added yet. */
  const raw = (data as { brand?: unknown }).brand;
  const brand: BrandKey | null = raw == null || raw === "" ? null : isBrandKey(raw) ? raw : null;
  if (raw != null && raw !== "" && !brand) return null;
  if (brand !== hostBrand) return null;

  return {
    id: data.id,
    username: data.username,
    // A brand login is staff, whatever the row says.
    role: !brand && data.role === "admin" ? "admin" : "staff",
    brand,
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
