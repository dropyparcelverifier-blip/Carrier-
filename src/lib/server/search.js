/**
 * Reduce a search term to letters and digits, lowercased.
 *
 * People type a PO as "Dropy 1856", "dropy-1856" or "DROPY1856" depending on
 * where they copied it from. All three describe the same parcel, so none of
 * them should come back empty. The database keeps a `search_key` column
 * normalised the same way.
 */
export function normalise(term) {
    return String(term ?? '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

/** Escape the wildcards PostgREST treats specially inside a filter value. */
export function escapeLike(term) {
    return term.replace(/[%_,()]/g, '');
}

/** A PostgREST `or` filter matching either the exact text or the loose key. */
export function looseFilter(term, columns = ['tracking_number', 'po_number']) {
    const key = escapeLike(normalise(term));
    const raw = escapeLike(String(term ?? '').trim());
    const parts = columns.map(c => `${c}.ilike.%${raw}%`);
    if (key) parts.push(`search_key.ilike.%${key}%`);
    return parts.join(',');
}
