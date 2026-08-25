import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "$env/dynamic/private";

/**
 * Service-role Supabase client. Bypasses row level security.
 *
 * Lives under $lib/server, which SvelteKit enforces at BUILD time — any
 * import of this from client-reachable code fails the build rather than
 * shipping the key to a browser. The Next version relied on convention
 * and a code comment.
 *
 * Built on first use, not at import: a build machine has no credentials
 * and doesn't need any. Validating at import time fails the build instead
 * of the request.
 */
let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (client) return client;

  const url = env.PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
