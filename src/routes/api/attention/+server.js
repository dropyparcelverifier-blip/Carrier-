import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { dbMessage } from '$lib/server/dberror.js';
import { looksLikeTracking } from '$lib/server/parcels.js';
import { streamOf } from '$lib/server/stream.js';

/**
 * Two piles that both mean "a human needs to decide something":
 *
 *   Parcels — the carrier reported a problem, or the record has gone quiet.
 *   Scans   — someone held a parcel we have no record of.
 *
 * Nothing is filtered away. Stray label barcodes are tagged rather than
 * hidden, so the real misses stay readable without losing anything.
 */
export async function GET({ url }) {
    const stream = streamOf(url);
    const { data: setting } = await db.from('app_settings')
        .select('value').eq('key', 'attention_quiet_days').maybeSingle();
    const quietDays = parseInt(setting?.value ?? '5', 10) || 5;

    const [flagged, scans, settled] = await Promise.all([
        db.from('attention_parcels')
            .select('tracking_number,po_number,order_ids,carrier,item_count,ship_date,shipment_date,delivery_state,delivery_status_raw,days_open,attention_group')
            .eq('stream', stream)
            .order('ship_date', { ascending: true, nullsFirst: false })
            .limit(500),

        db.from('unmatched_scans').select('*').order('scanned_at', { ascending: false }).limit(200),

        db.from('parcels')
            .select('tracking_number,po_number,order_ids,attention_state,attention_note,attention_by,attention_at,ship_date')
            .not('attention_state', 'is', null)
            .order('attention_at', { ascending: false })
            .limit(100)
    ]);

    if (flagged.error) throw error(503, dbMessage(flagged.error, 'Could not load'));

    const rows = flagged.data ?? [];
    const raw = scans.data ?? [];

    return json({
        quietDays,
        // Only the first two need a decision. The third is shown so nothing
        // is hidden, but it is normal transit and asks nothing of anyone.
        notDelivered: rows.filter(r => r.attention_group === 'not_delivered'),
        goneQuiet:    rows.filter(r => r.attention_group === 'gone_quiet'),
        stillEarly:   rows.filter(r => r.attention_group === 'still_early'),
        scans: raw.map(s => ({ ...s, plausible: looksLikeTracking(s.tracking_number) })),
        settled: settled.data ?? []
    });
}

export async function POST({ request, locals }) {
    if (locals.user.role !== 'admin') throw error(403, 'Admins only');

    let body;
    try { body = await request.json(); } catch { throw error(400, 'Bad request'); }

    const who = locals.user.display_name || locals.user.username;
    const action = body?.action;
    const tracking = String(body?.tracking ?? '').trim();

    // Bulk settle — parcels flagged on the same day for the same reason
    // almost always get the same verdict, so deciding once is the common case.
    if (action === 'settle_many') {
        const list = Array.isArray(body?.trackings) ? body.trackings.map(t => String(t).trim()).filter(Boolean) : [];
        const state = body?.state;
        if (!list.length) throw error(400, 'Nothing selected');
        if (!['cancelled', 'on_hold', 'resolved'].includes(state)) throw error(400, 'Unknown state');

        const patch = {
            attention_state: state,
            attention_note: String(body?.note ?? '').slice(0, 500),
            attention_by: who,
            attention_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        let done = 0;
        for (let i = 0; i < list.length; i += 200) {
            const chunk = list.slice(i, i + 200);
            const { data, error: e } = await db.from('parcels')
                .update(patch).in('tracking_number', chunk).select('tracking_number');
            if (e) throw error(503, dbMessage(e, 'Could not save'));
            done += data?.length ?? 0;
        }
        return json({ ok: true, done });
    }

    if (action === 'dismiss_many') {
        const list = Array.isArray(body?.trackings) ? body.trackings.map(t => String(t).trim()).filter(Boolean) : [];
        if (!list.length) throw error(400, 'Nothing selected');

        let done = 0;
        for (let i = 0; i < list.length; i += 200) {
            const chunk = list.slice(i, i + 200);
            const { data, error: e } = await db.from('scan_log')
                .update({ dismissed: true, dismissed_by: who, dismissed_at: new Date().toISOString() })
                .in('tracking_number', chunk).eq('action', 'not_found').select('id');
            if (e) throw error(503, dbMessage(e, 'Could not dismiss'));
            done += data?.length ?? 0;
        }
        return json({ ok: true, done });
    }

    if (action === 'settle') {
        const state = body?.state;
        if (!['cancelled', 'on_hold', 'resolved'].includes(state)) throw error(400, 'Unknown state');

        const { error: e } = await db.from('parcels').update({
            attention_state: state,
            attention_note: String(body?.note ?? '').slice(0, 500),
            attention_by: who,
            attention_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }).eq('tracking_number', tracking);

        if (e) throw error(503, dbMessage(e, 'Could not save'));
        return json({ ok: true });
    }

    if (action === 'reopen') {
        const { error: e } = await db.from('parcels').update({
            attention_state: null, attention_note: '', attention_by: '', attention_at: null,
            updated_at: new Date().toISOString()
        }).eq('tracking_number', tracking);
        if (e) throw error(503, dbMessage(e, 'Could not save'));
        return json({ ok: true });
    }

    if (action === 'dismiss_scan') {
        const { error: e } = await db.from('scan_log').update({
            dismissed: true, dismissed_by: who, dismissed_at: new Date().toISOString()
        }).eq('tracking_number', tracking).eq('action', 'not_found');
        if (e) throw error(503, dbMessage(e, 'Could not dismiss'));
        return json({ ok: true });
    }

    throw error(400, 'Unknown action');
}
