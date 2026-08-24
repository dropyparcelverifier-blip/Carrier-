import { db as supabase } from '$lib/server/db.js';
import { normalise, escapeLike } from '$lib/server/search.js';

/**
 * Every write here is conditional: the WHERE clause carries the precondition,
 * so Postgres decides the outcome in one statement. Two people acting at the
 * same moment cannot both win, and a dropped connection surfaces as an error
 * instead of a green tick over a write that never landed.
 *
 * Each function returns { ok, reason, data }. Callers must check `ok` —
 * never assume a call succeeded.
 */

export const OUTCOME = {
    OK: 'ok',
    OFFLINE: 'offline',          // request never completed — safe to retry
    TAKEN: 'taken',              // someone else got there first
    ALREADY: 'already',          // already in the desired state
    NOT_RECEIVED: 'not_received',
    NOT_FOUND: 'not_found'
};

function failed(error) {
    // Network drops, DNS failures and aborted fetches all arrive without a
    // Postgres error code. Those are retryable; a coded error is not.
    return {
        ok: false,
        reason: error?.code ? 'error' : OUTCOME.OFFLINE,
        message: error?.message ?? 'Connection lost',
        data: null
    };
}

/* ─────────────────────────────────────────────
   Mark a parcel received at the US warehouse
   ───────────────────────────────────────────── */
export async function receiveParcel(tracking, by) {
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('parcels')
        .update({
            warehouse_received: true,
            warehouse_received_at: now,
            warehouse_received_by: by,
            status: 'delivered',
            updated_at: now
        })
        .eq('tracking_number', tracking)
        .eq('warehouse_received', false)   // precondition: not already received
        .select('tracking_number,warehouse_received_at,warehouse_received_by');

    if (error) return failed(error);

    if (!data || data.length === 0) {
        // Nothing updated — either already received or no such parcel
        const { data: check, error: e2 } = await supabase
            .from('parcels')
            .select('tracking_number,warehouse_received,warehouse_received_at,warehouse_received_by')
            .eq('tracking_number', tracking)
            .maybeSingle();

        if (e2) return failed(e2);
        if (!check) return { ok: false, reason: OUTCOME.NOT_FOUND, data: null };
        return { ok: false, reason: OUTCOME.ALREADY, data: check };
    }

    // Log the scan. A failure here doesn't undo the receipt, so it must not
    // be reported as a failed receive.
    await supabase.from('scan_log')
        .insert({ tracking_number: tracking, scanned_by: by, action: 'received' });

    return { ok: true, reason: OUTCOME.OK, data: data[0] };
}

/* ─────────────────────────────────────────────
   Undo a receive

   Continuous scanning logs without a confirming tap, so a mis-read needs a way
   back. Only within a few minutes, and only if the parcel has not been boxed —
   after that it is history, not a mistake.
   ───────────────────────────────────────────── */
export async function undoReceive(tracking, by) {
    const { data: p, error: e0 } = await supabase
        .from('parcels')
        .select('tracking_number,warehouse_received,warehouse_received_at,box_id')
        .eq('tracking_number', tracking)
        .maybeSingle();

    if (e0) return failed(e0);
    if (!p) return { ok: false, reason: OUTCOME.NOT_FOUND, data: null };
    if (!p.warehouse_received) return { ok: false, reason: 'not_received', data: null };
    if (p.box_id) return { ok: false, reason: 'boxed', data: p };

    const age = Date.now() - new Date(p.warehouse_received_at ?? 0).getTime();
    if (age > 10 * 60 * 1000) return { ok: false, reason: 'too_late', data: p };

    const { error } = await supabase
        .from('parcels')
        .update({
            warehouse_received: false,
            warehouse_received_at: null,
            warehouse_received_by: null,
            status: 'shipped',
            updated_at: new Date().toISOString()
        })
        .eq('tracking_number', tracking)
        .eq('warehouse_received', true)
        .is('box_id', null);

    if (error) return failed(error);

    // The scan itself stays on record — it happened. Marked as undone so the
    // history shows both the read and the correction.
    await supabase.from('scan_log')
        .insert({ tracking_number: tracking, scanned_by: `${by} (undone)`, action: 'duplicate' });

    return { ok: true, reason: OUTCOME.OK, data: null };
}

/* ─────────────────────────────────────────────
   Claim a parcel into a box
   ───────────────────────────────────────────── */
export async function claimForBox(tracking, boxId, by, force = false) {
    const now = new Date().toISOString();

    const patch = { box_id: boxId, boxed_at: now, status: 'boxed', updated_at: now };

    // A parcel physically in India was self-evidently received at Jamaica,
    // whatever the scan log says. Forcing it in records that receipt too,
    // rather than leaving a parcel sitting in a box it never arrived for.
    if (force) {
        patch.warehouse_received = true;
        patch.warehouse_received_at = now;
        patch.warehouse_received_by = `${by} (added at packing)`;
    }

    let q = supabase
        .from('parcels')
        .update(patch)
        .eq('tracking_number', tracking)
        .is('box_id', null);                // precondition: unclaimed

    // Normally a parcel must be on hand. Forcing skips only that check —
    // never the unclaimed one, so two boxes still cannot take the same parcel.
    if (!force) q = q.eq('warehouse_received', true);

    const { data, error } = await q.select('tracking_number,box_id,boxed_at');

    if (error) return failed(error);

    if (!data || data.length === 0) {
        const { data: check, error: e2 } = await supabase
            .from('parcels')
            .select('tracking_number,box_id,warehouse_received')
            .eq('tracking_number', tracking)
            .maybeSingle();

        if (e2) return failed(e2);
        if (!check) return { ok: false, reason: OUTCOME.NOT_FOUND, data: null };
        if (!check.warehouse_received) return { ok: false, reason: OUTCOME.NOT_RECEIVED, data: check };
        if (check.box_id === boxId) return { ok: false, reason: OUTCOME.ALREADY, data: check };
        return { ok: false, reason: OUTCOME.TAKEN, data: check };
    }

    if (force) {
        await supabase.from('scan_log').insert({
            tracking_number: tracking,
            scanned_by: `${by} (added at packing)`,
            action: 'received'
        });
    }

    return { ok: true, reason: OUTCOME.OK, data: data[0] };
}

/* ─────────────────────────────────────────────
   Release a parcel from a box
   ───────────────────────────────────────────── */
export async function releaseFromBox(tracking, boxId) {
    const { error: e1 } = await supabase
        .from('box_items').delete()
        .eq('box_id', boxId).eq('tracking_number', tracking);
    if (e1) return failed(e1);

    const { error: e2 } = await supabase
        .from('parcels')
        .update({ box_id: null, boxed_at: null, status: 'delivered', updated_at: new Date().toISOString() })
        .eq('tracking_number', tracking)
        .eq('box_id', boxId);
    if (e2) return failed(e2);

    return { ok: true, reason: OUTCOME.OK, data: null };
}

/* ─────────────────────────────────────────────
   Look a parcel up by tracking, then by PO
   ───────────────────────────────────────────── */
export async function findParcel(term) {
    const q = String(term || '').trim();
    if (!q) return { ok: false, reason: OUTCOME.NOT_FOUND, data: null };

    const { data: exact, error } = await supabase
        .from('parcels').select('*').eq('tracking_number', q).maybeSingle();
    if (error) return failed(error);
    if (exact) return { ok: true, reason: OUTCOME.OK, data: exact, many: null };

    // Fall back to the PO, ignoring punctuation
    const key = escapeLike(normalise(q));
    const { data: byPo, error: e2 } = await supabase
        .from('parcels').select('*')
        .or(`po_number.ilike.%${escapeLike(q)}%,search_key.ilike.%${key}%`)
        .limit(20);
    if (e2) return failed(e2);

    if (!byPo || byPo.length === 0) return { ok: false, reason: OUTCOME.NOT_FOUND, data: null };
    if (byPo.length === 1) return { ok: true, reason: OUTCOME.OK, data: byPo[0], many: null };
    return { ok: true, reason: OUTCOME.OK, data: null, many: byPo };
}

/* ─────────────────────────────────────────────
   Candidates for a box, as a list to choose from

   Never auto-selects. A PO can cover several parcels and a partial tracking
   number can match more than one, so picking silently is how the wrong parcel
   ends up in a box.
   ───────────────────────────────────────────── */
export async function findCandidates(term, boxId, isAdmin) {
    const q = String(term ?? '').trim();
    if (!q) return { ok: true, rows: [] };

    const key = escapeLike(normalise(q));
    const raw = escapeLike(q);

    // People remember what a thing was called far more often than they
    // remember its tracking number, so the item name is searched too.
    const { data: hits } = await supabase
        .from('parcel_items')
        .select('tracking_number')
        .or(`title.ilike.%${raw}%,asin.ilike.%${raw}%`)
        .limit(200);
    const fromItems = [...new Set((hits ?? []).map(h => h.tracking_number))];

    const [byParcel, byItem] = await Promise.all([
        supabase.from('parcels')
            .select('tracking_number,po_number,order_ids,carrier,item_count,shipment_date,delivery_state,delivery_status_raw,warehouse_received,warehouse_received_at,box_id')
            .or(`tracking_number.ilike.%${raw}%,po_number.ilike.%${raw}%,search_key.ilike.%${key}%`)
            .eq('stream', 'dropy')
            .limit(25),
        fromItems.length
            ? supabase.from('parcels')
                .select('tracking_number,po_number,order_ids,carrier,item_count,shipment_date,delivery_state,delivery_status_raw,warehouse_received,warehouse_received_at,box_id')
                .in('tracking_number', fromItems)
                .eq('stream', 'dropy')
                .limit(25)
            : Promise.resolve({ data: [] })
    ]);

    if (byParcel.error) return failed(byParcel.error);

    const seen = new Set();
    const data = [...(byParcel.data ?? []), ...(byItem.data ?? [])]
        .filter(p => (seen.has(p.tracking_number) ? false : seen.add(p.tracking_number)))
        .sort((a, b) => Number(b.warehouse_received) - Number(a.warehouse_received));

    const error = null;
    if (error) return failed(error);

    const rows = (data ?? []).map(p => {
        let state, why, selectable;

        if (p.box_id === boxId) {
            state = 'in_this_box';
            why = 'Already in this box';
            selectable = false;
        } else if (p.box_id) {
            state = 'in_other_box';
            why = `Packed in ${p.box_id}`;
            selectable = false;
        } else if (p.warehouse_received) {
            state = 'ready';
            why = 'On hand';
            selectable = true;
        } else {
            state = 'not_received';
            why = 'Not scanned at Jamaica';
            // An admin can vouch for a parcel in front of them; a packer cannot.
            selectable = isAdmin;
        }

        return { ...p, state, why, selectable };
    });

    return { ok: true, rows };
}

/* ─────────────────────────────────────────────
   Record a scan that matched nothing
   ───────────────────────────────────────────── */
const TRACKING_SHAPES = [
    /^TBA[A-Z0-9]{9,}$/i,        // Amazon Logistics
    /^1Z[A-Z0-9]{16}$/i,         // UPS
    /^9[234]\d{18,24}$/,         // USPS
    /^\d{12,22}$/,               // FedEx and other numeric
    /^D\d{12,}$/i,               // Dashlink and similar
    /^[A-Z]{2}\d{9}[A-Z]{2}$/i   // international
];

/** Does this look like a carrier tracking number at all?
 *  Used to sort real misses from stray label barcodes in Need Attention —
 *  nothing is discarded either way. */
export function looksLikeTracking(code) {
    const c = String(code || '').trim();
    return TRACKING_SHAPES.some(re => re.test(c));
}

export async function logUnmatched(code, by) {
    const { error } = await supabase.from('scan_log')
        .insert({ tracking_number: String(code).trim(), scanned_by: by, action: 'not_found' });
    return error ? failed(error) : { ok: true, reason: OUTCOME.OK, data: null };
}

export async function logDuplicate(code, by) {
    await supabase.from('scan_log')
        .insert({ tracking_number: String(code).trim(), scanned_by: by, action: 'duplicate' });
}
