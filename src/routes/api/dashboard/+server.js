import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { parcelCounts } from '$lib/server/counts.js';
import { dbMessage } from '$lib/server/dberror.js';
import { streamOf } from '$lib/server/stream.js';

export async function GET({ url }) {
    const stream = streamOf(url);
    const counts = await parcelCounts(stream);

    const { data: missing, error: e1 } = await db.from('parcels')
        .select('tracking_number,po_number,carrier,item_count,shipment_date,ship_date')
        .eq('stream', stream)
        .eq('delivery_state', 'delivered')
        .eq('warehouse_received', false)
        .is('attention_state', null)
        .order('ship_date', { ascending: true, nullsFirst: false })
        .limit(20);

    if (e1) { console.error('[api/dashboard]', e1); throw error(503, dbMessage(e1, 'Could not load')); }

    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    const { data: scans } = await db.from('scan_log')
        .select('tracking_number,scanned_at,scanned_by')
        .eq('action', 'received')
        .gte('scanned_at', midnight.toISOString())
        .order('scanned_at', { ascending: false })
        .limit(100);

    return json({ counts, missing: missing ?? [], today: scans ?? [] });
}
