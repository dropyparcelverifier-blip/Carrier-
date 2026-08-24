import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { dbMessage } from '$lib/server/dberror.js';
import { streamOf } from '$lib/server/stream.js';

/**
 * Date-wise cohorts.
 *
 * A single receiving percentage over a growing pile is not actionable —
 * new parcels arrive daily and old ones clear daily, so the number drifts
 * toward a constant and tells you nothing. Grouping by shipment date does:
 * "of the parcels shipped on the 10th, four are still unaccounted for."
 */
export async function GET({ url }) {
    const stream = streamOf(url);
    const day = url.searchParams.get('day');

    // Drill-down: everything ordered on one date
    if (day) {
        const { data, error: e } = await db.from('parcels')
            .select('tracking_number,po_number,carrier,item_count,order_date,order_on,ship_date,shipment_date,delivery_state,delivery_status_raw,warehouse_received,warehouse_received_at,warehouse_received_by,attention_state,box_id')
            .eq('order_on', day)
            .eq('stream', stream)
            .order('warehouse_received', { ascending: true })
            .order('tracking_number');

        if (e) throw error(503, dbMessage(e, 'Could not load that day'));

        const rows = data ?? [];
        return json({
            day,
            scanned: rows.filter(r => r.warehouse_received),
            missing: rows.filter(r => !r.warehouse_received && r.delivery_state === 'delivered' && !r.attention_state),
            open:    rows.filter(r => !r.warehouse_received && r.delivery_state !== 'delivered' && !r.attention_state),
            settled: rows.filter(r => r.attention_state)
        });
    }

    // Summary across the last 60 shipment dates
    const { data, error: e } = await db.from(stream === 'bm' ? 'bm_cohorts' : 'delivery_cohorts')
        .select('*')
        .order('day', { ascending: false })
        .limit(60);

    if (e) throw error(503, dbMessage(e, 'Could not load cohorts'));

    const days = (data ?? []).map(d => ({ ...d, ship_date: d.day }));

    // Which days a report has actually covered
    const { data: covered } = await db.from('upload_days').select('day');
    // Trimmed to the date part: a date column arrives as '2026-08-01' from
    // PostgREST but as a full timestamp from some drivers, and a mismatch here
    // would quietly mark every day as uncovered.
    const coveredSet = new Set((covered ?? []).map(d => String(d.day).slice(0, 10)));

    const totals = days.reduce((t, d) => ({
        delivered: t.delivered + Number(d.delivered ?? 0),
        scanned:   t.scanned   + Number(d.scanned ?? 0),
        missing:   t.missing   + Number(d.missing ?? 0),
        delayed:   t.delayed   + Number(d.delayed ?? 0)
    }), { delivered: 0, scanned: 0, missing: 0, delayed: 0 });

    return json({
        days: days.map(d => ({ ...d, covered: coveredSet.has(String(d.day).slice(0, 10)) })),
        totals,
        coveredDays: Array.from(coveredSet)
    });
}
