import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { receiveParcel, undoReceive, findParcel, logUnmatched, logDuplicate } from '$lib/server/parcels.js';
import { parcelCounts } from '$lib/server/counts.js';
import { looseFilter } from '$lib/server/search.js';
import { streamOf } from '$lib/server/stream.js';
import { dbMessage } from '$lib/server/dberror.js';

const PAGE = 10;

/* ── list, counts, or a single lookup ── */
export async function GET({ url }) {
    const stream = streamOf(url);
    const mode = url.searchParams.get('mode') ?? 'list';
    const q = (url.searchParams.get('q') ?? '').trim();

    if (mode === 'find') {
        const out = await findParcel(q);
        return json(out);
    }

    const filter = url.searchParams.get('filter') ?? 'hold';
    const page = Math.max(0, parseInt(url.searchParams.get('page') ?? '0', 10) || 0);
    const size = Math.min(50, parseInt(url.searchParams.get('size') ?? String(PAGE), 10) || PAGE);

    const counts = await parcelCounts(stream);

    // Scoped to one warehouse — a mixed manifest would be worse than useless
    let sel = db.from('parcels').select('*', { count: 'exact' }).eq('stream', stream);

    if (filter === 'hold')      sel = sel.eq('warehouse_received', false).is('attention_state', null).order('ship_date', { ascending: true, nullsFirst: false });
    else if (filter === 'ok')   sel = sel.eq('warehouse_received', true).order('warehouse_received_at', { ascending: false });
    else if (filter === 'bad')  sel = sel.eq('warehouse_received', false).eq('delivery_state', 'delivered').is('attention_state', null).order('ship_date', { ascending: true, nullsFirst: false });
    else                        sel = sel.order('updated_at', { ascending: false });

    // Spans the whole manifest, not just the page in view, and ignores
    // punctuation — "Dropy 1856" finds "Dropy-1856".
    if (q) sel = sel.or(looseFilter(q));

    const from = page * size;
    const { data, count, error: e } = await sel.range(from, from + size - 1);
    if (e) {
        console.error('[api/parcels]', e);
        throw error(503, dbMessage(e, 'Could not load the manifest'));
    }

    return json({
        rows: data ?? [],
        total: count ?? 0,
        page,
        size,
        pages: Math.max(1, Math.ceil((count ?? 0) / size)),
        counts
    });
}

/* ── actions ── */
export async function POST({ request, locals }) {
    let body;
    try { body = await request.json(); } catch { throw error(400, 'Bad request'); }

    const who = locals.user.display_name || locals.user.username;
    const action = body?.action;
    const tracking = String(body?.tracking ?? '').trim();

    if (action === 'receive') {
        if (!tracking) throw error(400, 'Tracking required');
        const out = await receiveParcel(tracking, who);
        return json(out);
    }

    if (action === 'unreceive') {
        if (!tracking) throw error(400, 'Tracking required');
        const out = await undoReceive(tracking, who);
        return json(out);
    }

    if (action === 'log_unmatched') {
        await logUnmatched(tracking, who);
        return json({ ok: true });
    }

    if (action === 'log_duplicate') {
        await logDuplicate(tracking, who);
        return json({ ok: true });
    }

    if (action === 'attention') {
        if (locals.user.role !== 'admin') throw error(403, 'Admins only');
        const state = body?.state;
        if (!['cancelled', 'on_hold', 'resolved', null].includes(state)) {
            throw error(400, 'Unknown state');
        }
        const { error: e } = await db.from('parcels').update({
            attention_state: state,
            attention_note: String(body?.note ?? '').slice(0, 500),
            attention_by: who,
            attention_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }).eq('tracking_number', tracking);
        if (e) { console.error('[api/parcels attention]', e); throw error(503, dbMessage(e, 'Could not save')); }
        return json({ ok: true });
    }

    throw error(400, 'Unknown action');
}
