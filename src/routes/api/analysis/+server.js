import { json, error } from '@sveltejs/kit';
import { db, fetchAll } from '$lib/server/db.js';
import { dbMessage } from '$lib/server/dberror.js';
import { normalise, escapeLike } from '$lib/server/search.js';

/**
 * Three read-only reports over data the packing flow already captures.
 * `view` picks which.
 */
export async function GET({ url }) {
    const view = url.searchParams.get('view') ?? 'weights';
    const q = (url.searchParams.get('q') ?? '').trim();

    /* ── weight map ── */
    if (view === 'weights') {
        const asin = url.searchParams.get('asin');

        // Every weighing of one ASIN, newest first
        if (asin) {
            const { data, error: e } = await db.from('weight_map')
                .select('*').eq('asin', asin)
                .order('packed_at', { ascending: false }).limit(200);
            if (e) throw error(503, dbMessage(e, 'Could not load'));
            return json({ asin, entries: data ?? [] });
        }

        let sel = db.from('weight_map_summary').select('*')
            .order('times_weighed', { ascending: false }).limit(300);

        if (q) {
            // Search by ASIN or title directly; tracking, PO and order ID
            // have to go through the detail rows first.
            const raw = escapeLike(q);
            const { data: hits } = await db.from('weight_map')
                .select('asin')
                .or(`tracking_number.ilike.%${raw}%,po_number.ilike.%${raw}%,order_id.ilike.%${raw}%,asin.ilike.%${raw}%,title.ilike.%${raw}%`)
                .limit(500);
            const asins = [...new Set((hits ?? []).map(h => h.asin))];
            if (asins.length === 0) return json({ rows: [], total: 0 });
            sel = sel.in('asin', asins);
        }

        const { data, error: e } = await sel;
        if (e) throw error(503, dbMessage(e, 'Could not load the weight map'));

        return json({ rows: data ?? [], total: (data ?? []).length });
    }

    /* ── quantity discrepancies ── */
    if (view === 'discrepancies') {
        let sel = db.from('discrepancies').select('*')
            .order('packed_at', { ascending: false }).limit(300);
        if (q) {
            const raw = escapeLike(q);
            sel = sel.or(`tracking_number.ilike.%${raw}%,po_number.ilike.%${raw}%,asin.ilike.%${raw}%,title.ilike.%${raw}%`);
        }

        const { data, error: e } = await sel;
        if (e) throw error(503, dbMessage(e, 'Could not load'));

        const rows = data ?? [];
        return json({
            rows,
            short: rows.filter(r => r.kind === 'short' || r.kind === 'nothing in the parcel').length,
            extra: rows.filter(r => r.kind === 'extra').length,
            valueDelta: rows.reduce((s, r) => s + Number(r.value_delta ?? 0), 0)
        });
    }

    /* ── turnaround ── */
    if (view === 'turnaround') {
        // Paged, not limited: a median taken from the first thousand rows is
        // wrong in a way nobody would notice.
        const { data, error: e } = await fetchAll(() =>
            db.from('parcel_turnaround').select('*').not('warehouse_received_at', 'is', null));
        if (e) throw error(503, dbMessage(e, 'Could not load'));

        const rows = data ?? [];
        const boxed = rows.filter(r => r.days_to_box != null);
        const waiting = rows.filter(r => r.stage === 'waiting');

        const days = boxed.map(r => Number(r.days_to_box)).sort((a, b) => a - b);
        const median = days.length
            ? (days.length % 2 ? days[(days.length - 1) / 2]
                               : (days[days.length / 2 - 1] + days[days.length / 2]) / 2)
            : null;

        // Oldest waiting first — those are the ones to chase
        const now = Date.now();
        const aging = waiting
            .map(r => ({ ...r, waitingDays: Math.floor((now - new Date(r.warehouse_received_at)) / 864e5) }))
            .sort((a, b) => b.waitingDays - a.waitingDays)
            .slice(0, 40);

        // Distribution in day buckets, so a long tail is visible
        const buckets = [0, 0, 0, 0, 0, 0];
        const labels = ['same day', '1 day', '2 days', '3–4 days', '5–7 days', '8+ days'];
        for (const d of days) {
            if (d < 1) buckets[0]++;
            else if (d < 2) buckets[1]++;
            else if (d < 3) buckets[2]++;
            else if (d < 5) buckets[3]++;
            else if (d < 8) buckets[4]++;
            else buckets[5]++;
        }

        return json({
            boxedCount: boxed.length,
            waitingCount: waiting.length,
            avgDays: days.length ? +(days.reduce((s, d) => s + d, 0) / days.length).toFixed(1) : null,
            medianDays: median != null ? +median.toFixed(1) : null,
            slowest: days.length ? +days[days.length - 1].toFixed(1) : null,
            buckets, labels,
            aging
        });
    }

    throw error(400, 'Unknown view');
}
