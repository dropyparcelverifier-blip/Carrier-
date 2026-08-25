import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Service-role Supabase client — bypasses Row Level Security entirely.
 * SERVER-ONLY: unlike NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * has no NEXT_PUBLIC_ prefix, so Next.js never inlines it into the browser
 * bundle — reading it from a "use client" file returns undefined rather than
 * leaking the key. Still: import this only from API route handlers / server
 * components, never from a "use client" file.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  if (!cached) {
    cached = createClient(url, serviceKey, { auth: { persistSession: false } });
  }
  return cached;
}

/** True when both Supabase env vars for the service-role client are present. */
export const isSupabaseAdminConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);
