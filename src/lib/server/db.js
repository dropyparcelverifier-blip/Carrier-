import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

/**
 * Server-only database client.
 *
 * Uses the service role key, which bypasses row level security. It must never
 * be imported into anything the browser can load — the `$lib/server` path makes
 * SvelteKit enforce that at build time.
 *
 * The client is built on first use rather than at import. A build machine has
 * no credentials and does not need any; requiring them at import time would
 * fail the build instead of the request, which is both later than necessary
 * and harder to read.
 */

let client = null;

function connect() {
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        const missing = [
            !url ? 'SUPABASE_URL' : null,
            !key ? 'SUPABASE_SERVICE_ROLE_KEY' : null
        ].filter(Boolean).join(' and ');

        throw new Error(
            `Missing ${missing}.\n\n` +
            `Local: put them in .env\n` +
            `Vercel: Settings → Environment Variables, then redeploy\n\n` +
            `  SUPABASE_URL=https://<project>.supabase.co\n` +
            `  SUPABASE_SERVICE_ROLE_KEY=<service role key, not the anon key>\n` +
            `  SESSION_SECRET=<long random string>\n\n` +
            `Both keys are in Supabase → Settings → API.`
        );
    }

    if (url.includes('/rest/v1')) {
        throw new Error(
            `SUPABASE_URL should be the project URL only — drop the /rest/v1 suffix.\n` +
            `  Correct: https://<project>.supabase.co`
        );
    }

    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
}

/** Looks like a Supabase client, but connects on the first call. */
export const db = new Proxy({}, {
    get(_, prop) {
        client ??= connect();
        const value = client[prop];
        return typeof value === 'function' ? value.bind(client) : value;
    }
});

/**
 * Read every row of a query, a page at a time.
 *
 * Supabase caps an API response at 1,000 rows and says nothing when it
 * truncates — the query simply returns less than you asked for. Anything
 * that has to be complete (an export, a statistic) has to page, or it
 * quietly reports on the first thousand rows and looks plausible.
 *
 * Pass a function that builds the query fresh each time, since a range
 * cannot be reapplied to a query that already has one.
 */
export async function fetchAll(build, { page = 1000, cap = 50000 } = {}) {
    const rows = [];
    const seen = new Set();

    for (let from = 0; from < cap; from += page) {
        const { data, error } = await build().range(from, from + page - 1);
        if (error) return { data: null, error };
        if (!data || data.length === 0) break;

        // A server that ignores the range returns the whole table every time,
        // and the loop would run until the cap building a vast duplicate list.
        // Getting back more than a page was asked for is that, so stop.
        if (data.length > page) { rows.push(...data); break; }

        // Same defence for a server that pages but always from zero
        const first = JSON.stringify(data[0]);
        if (seen.has(first)) break;
        seen.add(first);

        rows.push(...data);
        if (data.length < page) break;
    }
    return { data: rows, error: null };
}
