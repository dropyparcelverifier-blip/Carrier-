import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { claimForBox, releaseFromBox, findParcel, findCandidates, OUTCOME } from '$lib/server/parcels.js';

/* ── box detail, or the item list for a parcel about to be packed ── */
export async function GET({ params, url, locals }) {
    const boxId = params.id;
    const find = url.searchParams.get('find');
    const want = url.searchParams.get('pull');
    const isAdmin = locals.user.role === 'admin';

    // Search: a list to choose from, never an automatic pick
    if (find !== null) {
        const term = String(find).trim();

        // A scanned barcode is an exact tracking number and means one parcel.
        // Making someone confirm a list of one defeats the point of scanning.
        if (term) {
            const { data: hit } = await db.from('parcels')
                .select('tracking_number,box_id,warehouse_received')
                .eq('tracking_number', term)
                .eq('stream', 'dropy')
                .maybeSingle();

            if (hit && !hit.box_id && (hit.warehouse_received || isAdmin)) {
                return json({ rows: [], isAdmin, exact: hit.tracking_number });
            }
        }

        const out = await findCandidates(term, boxId, isAdmin);
        if (!out.ok) throw error(503, 'Search failed');
        return json({ rows: out.rows, isAdmin });
    }

    // Pull one parcel's items, once the person has chosen it
    if (want) {
        const { data: p, error: e } = await db.from('parcels')
            .select('*').eq('tracking_number', want).maybeSingle();
        if (e) throw error(503, dbMessage(e, 'Could not load'));
        if (!p) return json({ ok: false, reason: 'not_found' });
        if (p.box_id && p.box_id !== boxId) return json({ ok: false, reason: 'taken', box_id: p.box_id });
        if (!p.warehouse_received && !isAdmin) return json({ ok: false, reason: 'not_received' });

        const { data: rawItems } = await db.from('parcel_items')
            .select('*').eq('tracking_number', p.tracking_number);

        const items = mergeByAsin(rawItems ?? []);

        // What each product weighed last time. The last value, not an average —
        // a packer wants "it was 165 g last time", not a statistic.
        const asins = items.map(i => i.asin).filter(Boolean);
        if (asins.length) {
            const { data: prev } = await db.from('last_weight')
                .select('asin,last_g,last_at').in('asin', asins);
            const byAsin = new Map((prev ?? []).map(r => [r.asin, r]));
            for (const it of items) {
                const hit = byAsin.get(it.asin);
                if (hit) { it.last_g = hit.last_g; it.last_at = hit.last_at; }
            }
        }

        return json({
            ok: true,
            parcel: p,
            items,
            // The screen needs to know it is about to vouch for a parcel
            // nobody scanned, so it can say so before anything is written.
            needsForce: !p.warehouse_received
        });
    }

    const [{ data: box }, { data: items }] = await Promise.all([
        db.from('boxes').select('*').eq('box_id', boxId).maybeSingle(),
        db.from('box_items').select('*').eq('box_id', boxId).order('packed_at', { ascending: false })
    ]);

    if (!box) throw error(404, 'No such box');
    return json({ box, items: items ?? [] });
}

/**
 * One parcel can carry the same product on two order lines — the same ASIN
 * ordered twice, shipped together. `parcel_items` keeps those apart because
 * its key includes the order, but `box_items` is keyed on ASIN alone, so
 * sending both in one write is rejected outright and nothing saves.
 *
 * Merging them is also the right answer for the packer: two identical rows
 * asking for a weight each is confusing, where "quantity 2" is not.
 */
function mergeByAsin(items) {
    const byAsin = new Map();

    for (const it of items) {
        // No ASIN means nothing to merge on — keep the line as its own row
        const key = it.asin || `__no_asin__${it.id}`;
        const hit = byAsin.get(key);

        if (!hit) {
            byAsin.set(key, { ...it, order_ids: [it.order_id].filter(Boolean) });
            continue;
        }

        hit.quantity = (Number(hit.quantity) || 0) + (Number(it.quantity) || 0);
        hit.item_total = (Number(hit.item_total) || 0) + (Number(it.item_total) || 0);
        if (it.order_id && !hit.order_ids.includes(it.order_id)) hit.order_ids.push(it.order_id);
    }

    return Array.from(byAsin.values());
}

/* ── add a parcel's contents to the box ── */
export async function POST({ params, request, locals }) {
    const boxId = params.id;
    let body;
    try { body = await request.json(); } catch { throw error(400, 'Bad request'); }

    const who = locals.user.display_name || locals.user.username;
    const tracking = String(body?.tracking ?? '').trim();
    const rows = Array.isArray(body?.items) ? body.items : [];
    const force = body?.force === true;

    if (!tracking || rows.length === 0) throw error(400, 'Tracking and items required');
    if (force && locals.user.role !== 'admin') throw error(403, 'Admins only');

    const { data: box } = await db.from('boxes').select('status').eq('box_id', boxId).maybeSingle();
    if (!box) throw error(404, 'No such box');
    if (box.status !== 'open') throw error(409, 'That box is closed');

    // The scale is on the packing table, so a missing weight is an omission
    // rather than a limitation. Checked here as well as on screen, since the
    // screen can be bypassed.
    for (const [i, it] of rows.entries()) {
        const w = Number(it.weight_g);
        if (it.weight_g === '' || it.weight_g == null || !Number.isFinite(w) || w <= 0) {
            throw error(400, `Row ${i + 1}: enter a weight above zero`);
        }
        const q = Number(it.qty_actual);
        if (!Number.isFinite(q) || q < 0) throw error(400, `Row ${i + 1}: check the quantity`);
        if (q !== Number(it.qty_expected) && !String(it.qty_reason ?? '').trim()) {
            throw error(400, `Row ${i + 1}: say why the quantity differs`);
        }
    }

    // Claim the parcel first, so a lost race can't leave item rows behind
    const claim = await claimForBox(tracking, boxId, who, force);
    if (!claim.ok && claim.reason !== OUTCOME.ALREADY) {
        return json({ ok: false, reason: claim.reason, box_id: claim.data?.box_id ?? null });
    }

    // Collapse any duplicate ASIN before writing — an upsert cannot touch the
    // same conflict key twice in one statement.
    const merged = new Map();
    for (const it of rows) {
        const key = String(it.asin ?? '');
        const hit = merged.get(key);
        if (!hit) { merged.set(key, { ...it }); continue; }
        hit.qty_expected = (Number(hit.qty_expected) || 0) + (Number(it.qty_expected) || 0);
        hit.qty_actual = (Number(hit.qty_actual) || 0) + (Number(it.qty_actual) || 0);
        // Weight is per unit, so it does not add up — keep the first non-empty
        if (hit.weight_g == null || hit.weight_g === '') hit.weight_g = it.weight_g;
        hit.item_total = (Number(hit.item_total) || 0) + (Number(it.item_total) || 0);
    }

    const payload = [...merged.values()].map(it => ({
        box_id: boxId,
        tracking_number: tracking,
        asin: String(it.asin ?? ''),
        title: String(it.title ?? ''),
        po_number: String(it.po_number ?? ''),
        qty_expected: Number(it.qty_expected) || 0,
        qty_actual: Number(it.qty_actual) || 0,
        qty_reason: String(it.qty_reason ?? '').slice(0, 300),
        weight_g: it.weight_g === '' || it.weight_g == null ? null : Number(it.weight_g),
        unit_price: it.unit_price ?? null,
        item_total: it.item_total ?? null,
        packed_by: who
    }));

    const { error: e } = await db.from('box_items')
        .upsert(payload, { onConflict: 'box_id,tracking_number,asin' });

    if (e) {
        // Contents failed after the claim landed — release it rather than
        // locking the parcel to a box with no record of it
        await releaseFromBox(tracking, boxId);
        console.error('[boxes/add]', e);
        throw error(503, dbMessage(e, 'Not saved'));
    }

    return json({ ok: true });
}

/* ── close, reopen, or remove a parcel ── */
export async function PATCH({ params, request, locals }) {
    const boxId = params.id;
    let body;
    try { body = await request.json(); } catch { throw error(400, 'Bad request'); }

    const who = locals.user.display_name || locals.user.username;
    const action = body?.action;

    // Correcting a weight without unpacking the row. Typing 1650 instead of
    // 165 used to mean removing the parcel and adding it again from scratch.
    if (action === 'set_weight') {
        const rowId = Number(body?.row_id);
        const w = Number(body?.weight_g);

        if (!Number.isFinite(rowId)) throw error(400, 'Which row?');
        if (!Number.isFinite(w) || w <= 0) throw error(400, 'Weight must be above zero');

        const { data: b } = await db.from('boxes').select('status').eq('box_id', boxId).maybeSingle();
        if (!b) throw error(404, 'No such box');
        if (b.status !== 'open') throw error(409, 'That box is closed');

        const { data, error: e } = await db.from('box_items')
            .update({ weight_g: w })
            .eq('id', rowId).eq('box_id', boxId)
            .select('id,asin,weight_g,qty_actual');

        if (e) throw error(503, dbMessage(e, 'Not saved'));
        if (!data?.length) throw error(404, 'Not in this box');

        return json({ ok: true, row: data[0] });
    }

    if (action === 'remove') {
        const tracking = String(body?.tracking ?? '').trim();
        const out = await releaseFromBox(tracking, boxId);
        if (!out.ok) throw error(503, 'Could not remove');
        return json({ ok: true });
    }

    if (action === 'close') {
        const empty = Number(body?.empty_weight);
        if (!Number.isFinite(empty) || empty < 0) throw error(400, 'Empty weight required');

        const { data, error: e } = await db.from('boxes').update({
            empty_weight: empty,
            status: 'closed',
            closed_at: new Date().toISOString(),
            closed_by: who,
            updated_at: new Date().toISOString()
        }).eq('box_id', boxId).eq('status', 'open').select('box_id');

        if (e) throw error(503, 'Could not close the box');
        if (!data?.length) throw error(409, 'That box is already closed');
        return json({ ok: true });
    }

    if (action === 'reopen') {
        if (locals.user.role !== 'admin') throw error(403, 'Admins only');
        const { error: e } = await db.from('boxes')
            .update({ status: 'open', closed_at: null, updated_at: new Date().toISOString() })
            .eq('box_id', boxId);
        if (e) throw error(503, 'Could not reopen');
        return json({ ok: true });
    }

    throw error(400, 'Unknown action');
}

/* ── delete an open box ──
   Its parcels go back to the pool rather than being stranded as boxed with
   no box to belong to. A closed box is a record and cannot be deleted. ── */
export async function DELETE({ params, locals }) {
    const boxId = params.id;

    const { data: box } = await db.from('boxes').select('status').eq('box_id', boxId).maybeSingle();
    if (!box) throw error(404, 'No such box');
    if (box.status !== 'open') throw error(409, 'A closed box cannot be deleted');

    // Free the parcels first, so nothing is left pointing at a box that has gone
    const { error: e1 } = await db.from('parcels')
        .update({ box_id: null, boxed_at: null, status: 'delivered', updated_at: new Date().toISOString() })
        .eq('box_id', boxId);
    if (e1) throw error(503, dbMessage(e1, 'Could not release the parcels'));

    const { error: e2 } = await db.from('box_items').delete().eq('box_id', boxId);
    if (e2) throw error(503, dbMessage(e2, 'Could not clear the contents'));

    const { error: e3 } = await db.from('boxes').delete().eq('box_id', boxId).eq('status', 'open');
    if (e3) throw error(503, dbMessage(e3, 'Could not delete the box'));

    return json({ ok: true });
}
