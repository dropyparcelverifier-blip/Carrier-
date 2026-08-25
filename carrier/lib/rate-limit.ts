/**
 * In-memory fixed-window rate limiter. Good enough for a single-instance
 * Next.js deployment; resets on redeploy and doesn't share state across
 * instances if this ever runs behind a multi-instance/serverless fleet —
 * for that, swap the Map for Redis (Supabase Postgres would also work via
 * a table + upsert, but adds a round-trip to every login attempt). Scoped
 * this way deliberately: the app has no other shared store today, and a
 * per-instance limiter still stops the case this exists for — a script
 * hammering /api/admin-login from one place.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export type RateLimitResult = { limited: false } | { limited: true; retryAfterSeconds: number };

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    return { limited: false };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return { limited: true, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { limited: false };
}

/** Call after a failed attempt. */
export function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count++;
  }
}

/** Call after a successful attempt to clear the counter. */
export function clearRateLimit(key: string): void {
  attempts.delete(key);
}
