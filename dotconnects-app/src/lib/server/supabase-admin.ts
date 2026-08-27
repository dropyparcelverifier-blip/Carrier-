import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "$env/dynamic/private";

/**
 * Service-role Supabase client. Bypasses row level security.
 *
 * Lives under $lib/server, which SvelteKit enforces at BUILD time — any
 * import of this from client-reachable code fails the build rather than
 * shipping the key to a browser.
 *
 * ── The env var is SUPABASE_URL, not PUBLIC_SUPABASE_URL ──
 *
 * $env/dynamic/private deliberately EXCLUDES anything prefixed PUBLIC_.
 * That prefix is SvelteKit's marker for "safe to send to the browser",
 * and the private module refuses to serve those so the two categories
 * can't be confused.
 *
 * Reading env.PUBLIC_SUPABASE_URL here returns undefined — always. That
 * made getSupabaseAdmin() return null, which made every lookup fall
 * through to lib/demo-data.ts, which made real tracking IDs report "not
 * found" with no error anywhere. Silent, and it looked like a data
 * problem rather than a config one.
 *
 * This app has no browser-side Supabase client at all — every query goes
 * through an API route with the service-role key — so nothing here needs
 * to be public.
 *
 * PUBLIC_SUPABASE_URL is still accepted as a fallback so an existing .env
 * keeps working, but SUPABASE_URL is the correct name.
 */
let client: SupabaseClient | null = null;
let warned = false;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (client) return client;

  const url = env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    // Say so ONCE. The failure this replaces was completely silent —
    // orders simply vanished into demo data with nothing logged.
    if (!warned) {
      warned = true;
      console.warn(
        "[supabase] Not configured — falling back to demo data.\n" +
          `  SUPABASE_URL              ${url ? "set" : "MISSING"}\n` +
          `  SUPABASE_SERVICE_ROLE_KEY ${key ? "set" : "MISSING"}\n` +
          "  Note: $env/dynamic/private does not expose PUBLIC_-prefixed vars.",
      );
    }
    return null;
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
