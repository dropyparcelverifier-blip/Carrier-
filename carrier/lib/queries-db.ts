import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase, for the enquiry form only.
 *
 * Carrier had its database access removed when tracking and admin moved
 * out, and that was right — a marketing site has no business reading
 * orders. This client exists for exactly one table.
 *
 * WHY NOT POST TO THE TRACKING APP INSTEAD: it would work, but it puts
 * the tracking app in the path of a marketing form. If track.* is down
 * for a deploy, enquiries would fail silently. One table, one client,
 * fewer moving parts between a prospect and a record of their interest.
 *
 * The service-role key is used because RLS on business_queries has no
 * policies — the anon key can do nothing. This module must therefore
 * NEVER be imported from a client component. Next has no build-time
 * enforcement of that the way SvelteKit's $lib/server does, so the
 * convention is: only route handlers under app/api import this.
 */
let client: SupabaseClient | null = null;
let warned = false;

export function getQueriesDb(): SupabaseClient | null {
  if (client) return client;

  // SUPABASE_URL is the correct name: nothing here reaches the browser, and
  // a NEXT_PUBLIC_ prefix on a server-only value invites someone to assume
  // it is safe to expose. The fallback is only so deployments already
  // carrying the prefixed name keep working — this module was written
  // reading the un-prefixed name while .env.local defined the prefixed one,
  // which 503'd every submission.
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    if (!warned) {
      warned = true;
      // Say so once. A silently unconfigured form accepts submissions and
      // drops them, which is worse than refusing them.
      console.warn(
        "[queries] Supabase not configured — the enquiry form will reject submissions.\n" +
          `  SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)  ${url ? "set" : "MISSING"}\n` +
          `  SUPABASE_SERVICE_ROLE_KEY                   ${key ? "set" : "MISSING"}`,
      );
    }
    return null;
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export type QueryInput = {
  business_name: string;
  business_desc?: string | null;
  contact_name?: string | null;
  email: string;
  phone?: string | null;
  subject: string;
  body: string;
};

/** Returns an error string, or null when the input is acceptable. */
export function validateQuery(q: Partial<QueryInput>): string | null {
  const name = (q.business_name ?? "").trim();
  const email = (q.email ?? "").trim();
  const subject = (q.subject ?? "").trim();
  const body = (q.body ?? "").trim();

  if (name.length < 2) return "Tell us your business name.";
  if (name.length > 120) return "That business name is too long.";
  // Deliberately loose. Strict email regexes reject valid addresses, and
  // the cost of a bad one here is a bounced reply, not a security hole.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "That email doesn't look right.";
  if (email.length > 200) return "That email is too long.";
  if (subject.length < 3) return "Add a subject.";
  if (subject.length > 200) return "That subject is too long.";
  if (body.length < 20) return "Tell us a bit more — at least a couple of sentences.";
  if (body.length > 5000) return "That message is too long. Email us directly instead.";
  if (q.phone && !/^[\d\s+()-]{6,20}$/.test(q.phone.trim())) return "That phone number doesn't look right.";
  return null;
}
