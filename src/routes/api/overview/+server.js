import { json, error } from '@sveltejs/kit';
import { db, fetchAll } from '$lib/server/db.js';
import { dbMessage } from '$lib/server/dberror.js';
import { escapeLike, normalise } from '$lib/server/search.js';
import { streamOf } from '$lib/server/stream.js';

/**
 * What is sitting at the warehouse, and for how long.
 *
 * Every other screen answers "what did we order" or "what did we pack". This
 * one answers the only question the receiving floor has: what turned up and
 * has not been dealt with, oldest first.
 */

/** Days between a delivery date and today, in the warehouse's own reckoning. */
function holdDays(deliveredOn) {
    if (!deliveredOn) return null;
    const d = new Date(String(deliveredOn).slice(0, 10) + 'T00:00:00Z');
    const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    return Math.max(0, Math.round((today - d) / 86400000));
}

/** Parcels that reached the warehouse and were never scanned in. */
function waiting(stream) {
    return db.from('parcels')
        .select('tracking_number,po_number,order_ids,carrier,item_count,order_date,order_on,delivery_on,delivery_state,warehouse_received,box_id')
        .eq('stream', stream)
        .eq('delivery_state', 'delivered')
        .eq('warehouse_received', false)
        .is('box_id', null);
}

export async function GET({ url }) {
    const stream = streamOf(url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const op = url.searchParams.get('op') ?? '';        // over | exactly | under
    const n = parseInt(url.searchParams.get('days') ?? '', 10);
    const sort = url.searchParams.get('sort') ?? 'hold';
    const dir = url.searchParams.get('dir') ?? 'desc';

    /* ── the four counts ──
       Counted in the database with head:true, so none of them can be
       truncated by the row cap however large the file gets. */
    const head = { count: 'exact', head: true };
    const base = () => db.from('parcels').select('*', head).eq('stream', stream);

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const [open, atWarehouse, boxed, held] = await Promise.all([
        base().is('box_id', null),
        base().eq('delivery_state', 'delivered').eq('warehouse_received', false).is('box_id', null),
        base().not('box_id', 'is', null),
        base().eq('delivery_state', 'delivered').eq('warehouse_received', false)
              .is('box_id', null).lt('delivery_on', weekAgo)
    ]);

    const cards = {
        open: open.count ?? 0,
        atWarehouse: atWarehouse.count ?? 0,
        boxed: boxed.count ?? 0,
        held: held.count ?? 0
    };

    /* ── the list ──
       Read in full rather than paged: hold days are worked out per row, and a
       page of rows cannot be sorted by a value the database never saw. */
    const { data, error: e } = await fetchAll(() => waiting(stream));
    if (e) throw error(503, dbMessage(e, 'Could not load'));

    let rows = (data ?? []).map(p => ({ ...p, hold: holdDays(p.delivery_on) }));

    // A parcel with no delivery date has no hold to speak of — it belongs at
    // the bottom rather than pretending to be zero days old.
    rows = rows.filter(r => r.hold !== null);

    if (q) {
        const key = normalise(q);
        const raw = q.toLowerCase();
        rows = rows.filter(r =>
            String(r.tracking_number ?? '').toLowerCase().includes(raw) ||
            String(r.po_number ?? '').toLowerCase().includes(raw) ||
            normalise(String(r.tracking_number ?? '') + String(r.po_number ?? '')).includes(key) ||
            (r.order_ids ?? []).some(o => String(o).toLowerCase().includes(raw))
        );
    }

    if (Number.isFinite(n)) {
        if (op === 'over') rows = rows.filter(r => r.hold > n);
        else if (op === 'under') rows = rows.filter(r => r.hold < n);
        else if (op === 'exactly') rows = rows.filter(r => r.hold === n);
    }

    const by = {
        hold: (a, b) => a.hold - b.hold,
        delivered: (a, b) => String(a.delivery_on).localeCompare(String(b.delivery_on)),
        tracking: (a, b) => String(a.tracking_number).localeCompare(String(b.tracking_number)),
        po: (a, b) => String(a.po_number ?? '').localeCompare(String(b.po_number ?? ''))
    }[sort] ?? ((a, b) => a.hold - b.hold);

    rows.sort((a, b) => (dir === 'asc' ? by(a, b) : by(b, a)));

    // Quick filters, counted before any filter is applied so the numbers on
    // the chips do not move as you use them
    const all = (data ?? []).map(p => holdDays(p.delivery_on)).filter(h => h !== null);
    const buckets = {
        all: all.length,
        over3: all.filter(h => h > 3).length,
        over7: all.filter(h => h > 7).length,
        today: all.filter(h => h === 0).length
    };

    return json({ cards, buckets, rows, total: rows.length });
}
