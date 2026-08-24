import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { dbMessage } from '$lib/server/dberror.js';
import { looseFilter } from '$lib/server/search.js';
import { streamOf } from '$lib/server/stream.js';

/**
 * The manifest as a calendar.
 *
 * A single list of 877 tracking numbers answers no question anyone actually
 * asks. Grouped by day with a colour, "which days still have parcels
 * outstanding" is visible at a glance, and the list becomes a drill-down.
 */
export async function GET({ url }) {
    const stream = streamOf(url);
    const month = url.searchParams.get('month');   // YYYY-MM
    const day = url.searchParams.get('day');       // YYYY-MM-DD

    /* ── one day, paged so the list can load as it scrolls ── */
    if (day) {
        const group = url.searchParams.get('group') ?? 'missing';
        const from = Math.max(0, parseInt(url.searchParams.get('from') ?? '0', 10) || 0);
        const size = Math.min(100, parseInt(url.searchParams.get('size') ?? '25', 10) || 25);
        const q = (url.searchParams.get('q') ?? '').trim();
        // 'ordered' keys on the day it was bought, 'delivered' on the day it
        // arrived — two different questions about the same parcel.
        const by = url.searchParams.get('by') === 'delivered' ? 'delivery_on' : 'order_on';

        let sel = db.from('parcels')
            .select('tracking_number,po_number,order_ids,carrier,item_count,order_date,order_on,delivery_on,shipment_date,delivery_state,delivery_status_raw,warehouse_received,warehouse_received_at,attention_state,box_id',
                    { count: 'exact' })
            .eq(by, day)
            .eq('stream', stream);

        if (group === 'received') {
            sel = sel.eq('warehouse_received', true)
                     .order('warehouse_received_at', { ascending: false });
        } else {
            sel = sel.eq('warehouse_received', false)
                     .order('tracking_number');
        }

        if (q) sel = sel.or(looseFilter(q));

        const { data, count, error: e } = await sel.range(from, from + size - 1);
        if (e) throw error(503, dbMessage(e, 'Could not load that day'));

        return json({
            day, group, from, size,
            rows: data ?? [],
            total: count ?? 0,
            more: (from + size) < (count ?? 0)
        });
    }

    /* ── a month of day totals ── */
    const now = new Date();
    const m = month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const first = `${m}-01`;
    const [yy, mm] = m.split('-').map(Number);
    const last = new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10);

    const [{ data, error: e }, { data: arr, error: e2 }] = await Promise.all([
        db.from('delivery_cohorts')
            .select('day,total,delivered,scanned,missing,in_transit,not_delivered')
            .gte('day', first).lte('day', last).order('day'),
        // The same month keyed on arrival rather than order
        db.from('delivery_day_cohorts')
            .select('day,total,delivered,scanned,missing,in_transit,not_delivered')
            .eq('stream', stream)
            .gte('day', first).lte('day', last).order('day')
    ]);

    if (e) throw error(503, dbMessage(e, 'Could not load the month'));
    if (e2) throw error(503, dbMessage(e2, 'Could not load deliveries'));

    // The span of real data, so the month arrows can stop at the edges
    const [{ data: a }, { data: b }] = await Promise.all([
        db.from('delivery_cohorts').select('day').order('day').limit(1),
        db.from('delivery_cohorts').select('day').order('day', { ascending: false }).limit(1)
    ]);

    return json({
        month: m,
        days: data ?? [],
        deliveryDays: arr ?? [],
        earliest: a?.[0]?.day ?? null,
        latest: b?.[0]?.day ?? null
    });
}
