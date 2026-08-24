/**
 * Turn a Postgres/PostgREST error into something a person can act on.
 *
 * The common one in this project is PostgREST serving a cached schema after
 * a migration adds a column — the column exists, but the API layer hasn't
 * noticed. That surfaces as PGRST204 or a 42703 and is fixed by running
 * `NOTIFY pgrst, 'reload schema';`
 */
export function dbMessage(e, fallback) {
    if (!e) return fallback;

    const code = e.code ?? '';
    const msg = e.message ?? '';

    if (code === 'PGRST204' || code === '42703' || /column .* does not exist/i.test(msg)) {
        return `${msg} — the database has this column but the API is serving a cached schema. `
             + `Run: NOTIFY pgrst, 'reload schema';`;
    }

    if (code === '42P01' || /relation .* does not exist/i.test(msg)) {
        return `${msg} — a migration has not been applied yet.`;
    }

    if (code === '21000' || /affect row a second time/i.test(msg)) {
        return `${msg} — the same product appears twice in this parcel. `
             + `Reload the page; duplicate lines are now merged automatically.`;
    }

    if (code === '42501' || /permission denied/i.test(msg)) {
        return `${msg} — check SUPABASE_SERVICE_ROLE_KEY is the service role key, not the anon key.`;
    }

    return msg || fallback;
}
