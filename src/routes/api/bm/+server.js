import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { dbMessage } from '$lib/server/dberror.js';
import { escapeLike } from '$lib/server/search.js';

/**
 * Bombino's side.
 *
 * Abhi ships whole parcels, so a box claims the parcel. Bombino opens the
 * parcels and clubs the contents, so there is no parcel to claim — a box takes
 * individual item lines, and a line can be split across boxes. Everything here
 * exists because of that one difference.
 */

/* ── what is available, and what a parcel is doing ── */
export async function GET({ url }) {
    const view = url.searchParams.get('view') ?? 'available';

    if (view === 'available') {
        const q = (url.searchParams.get('q') ?? '').trim();
        const from = Math.max(0, parseInt(url.searchParams.get('from') ?? '0', 10) || 0);
        const size = Math.min(100, parseInt(url.searchParams.get('size') ?? '30', 10) || 30);

        let sel = db.from('bm_available')
            .select('*', { count: 'exact' })
            .order('order_on', { ascending: false, nullsFirst: false });

        if (q) {
            const raw = escapeLike(q);
            sel = sel.or(`title.ilike.%${raw}%,asin.ilike.%${raw}%,po_number.ilike.%${raw}%,tracking_number.ilike.%${raw}%,order_id.ilike.%${raw}%`);
        }

        const { data, count, error: e } = await sel.range(from, from + size - 1);
        if (e) throw error(503, dbMessage(e, 'Could not search'));

        // Where the rest of a part-boxed line already went, so a packer can see
        // "4 of 12 left, the other 8 are in BM-A" rather than a bare number
        const ids = (data ?? []).filter(r => r.qty_boxed > 0).map(r => r.item_id);
        let splits = [];
        if (ids.length) {
            const { data: sp } = await db.from('bm_splits')
                .select('item_id,box_id,qty_in_box').in('item_id', ids);
            splits = sp ?? [];
        }
        const byItem = new Map();
        for (const s of splits) {
            if (!byItem.has(s.item_id)) byItem.set(s.item_id, []);
            byItem.get(s.item_id).push(s);
        }

        return json({
            rows: (data ?? []).map(r => ({ ...r, elsewhere: byItem.get(r.item_id) ?? [] })),
            total: count ?? 0,
            from, size,
            more: (from + size) < (count ?? 0)
        });
    }

    /* ── the BM manifest, one row per parcel ── */
    if (view === 'manifest') {
        const day = url.searchParams.get('day');
        const state = url.searchParams.get('state');
        const from = Math.max(0, parseInt(url.searchParams.get('from') ?? '0', 10) || 0);
        const size = Math.min(200, parseInt(url.searchParams.get('size') ?? '50', 10) || 50);
        const q = (url.searchParams.get('q') ?? '').trim();

        const by = url.searchParams.get('by') === 'delivered' ? 'delivery_on' : 'order_on';

        let sel = db.from('bm_parcel_state')
            .select('*', { count: 'exact' })
            .order(by, { ascending: false, nullsFirst: false });

        if (day) sel = sel.eq(by, day);
        if (state) sel = sel.eq('state', state);
        if (q) {
            const raw = escapeLike(q);
            sel = sel.or(`tracking_number.ilike.%${raw}%,po_number.ilike.%${raw}%`);
        }

        const { data, count, error: e } = await sel.range(from, from + size - 1);
        if (e) throw error(503, dbMessage(e, 'Could not load the manifest'));

        return json({ rows: data ?? [], total: count ?? 0, from, size,
                      more: (from + size) < (count ?? 0) });
    }

    /* ── days, and the totals above them ──
       Counted in the database, one row per day. Adding up every parcel in
       the browser silently stopped at Supabase's 1,000-row cap, so a stream
       with more than a thousand parcels reported less than it held. */
    if (view === 'days') {
        const [{ data: days, error: e1 }, { data: tot, error: e2 }, { data: arr }] =
            await Promise.all([
                db.from('bm_days').select('*').order('day', { ascending: false }),
                db.from('bm_totals').select('*').maybeSingle(),
                // the same days keyed on arrival rather than order
                db.from('bm_delivery_days').select('*').order('day', { ascending: false })
            ]);
        if (e1) throw error(503, dbMessage(e1, 'Could not load'));
        if (e2) throw error(503, dbMessage(e2, 'Could not load'));

        return json({ days: days ?? [], deliveryDays: arr ?? [], totals: tot ?? null });
    }

    throw error(400, 'Unknown view');
}


/* ── building a box, and settling history ── */
export async function POST({ request, locals }) {
    if (locals.user.role !== 'admin') throw error(403, 'Admins only');

    let body;
    try { body = await request.json(); } catch { throw error(400, 'Bad request'); }

    const who = locals.user.display_name || locals.user.username;
    const action = body?.action;

    if (action === 'add') {
        const { data, error: e } = await db.rpc('bm_box_add', {
            p_item_id: Number(body?.item_id),
            p_box_id: String(body?.box_id ?? ''),
            p_qty: Number(body?.qty),
            p_weight: Number(body?.weight_g),
            p_by: who,
            p_reason: String(body?.reason ?? '').slice(0, 300)
        });
        if (e) throw error(503, dbMessage(e, 'Could not add'));
        // The function returns one row: ok, reason, qty_left
        return json(Array.isArray(data) ? data[0] : data);
    }

    if (action === 'remove') {
        const { data, error: e } = await db.rpc('bm_box_remove', {
            p_box_id: String(body?.box_id ?? ''),
            p_row_id: Number(body?.row_id)
        });
        if (e) throw error(503, dbMessage(e, 'Could not remove'));
        return json(Array.isArray(data) ? data[0] : data);
    }

    if (action === 'delete_box') {
        const { data, error: e } = await db.rpc('bm_box_delete', {
            p_box_id: String(body?.box_id ?? '')
        });
        if (e) throw error(503, dbMessage(e, 'Could not delete'));
        return json(Array.isArray(data) ? data[0] : data);
    }

    // Months of stock Bombino shipped by hand before this existed. Marking it
    // settled keeps it out of the box builder without inventing a box.
    if (action === 'mark_sent') {
        const list = Array.isArray(body?.trackings) ? body.trackings.map(String) : [];
        if (!list.length) throw error(400, 'Nothing selected');

        const { data, error: e } = await db.rpc('bm_mark_sent', {
            p_tracking: list, p_by: who,
            p_note: String(body?.note ?? 'sent before the system').slice(0, 300)
        });
        if (e) throw error(503, dbMessage(e, 'Could not mark'));
        return json(Array.isArray(data) ? data[0] : data);
    }

    if (action === 'unmark_sent') {
        const list = Array.isArray(body?.trackings) ? body.trackings.map(String) : [];
        if (!list.length) throw error(400, 'Nothing selected');

        const { data, error: e } = await db.rpc('bm_unmark_sent', { p_tracking: list });
        if (e) throw error(503, dbMessage(e, 'Could not unmark'));
        return json(Array.isArray(data) ? data[0] : data);
    }

    throw error(400, 'Unknown action');
}
