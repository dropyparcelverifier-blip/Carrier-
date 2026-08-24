import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { dbMessage } from '$lib/server/dberror.js';
import { normalise, escapeLike } from '$lib/server/search.js';

/**
 * One search box, three kinds of input.
 *
 * A tracking number identifies one parcel. A PO or an order ID can span
 * several, so those return a list to pick from rather than guessing.
 */
export async function GET({ url }) {
    const q = (url.searchParams.get('q') ?? '').trim();
    if (!q) return json({ found: false });

    const from = Math.max(0, parseInt(url.searchParams.get('from') ?? '0', 10) || 0);
    const size = Math.min(100, parseInt(url.searchParams.get('size') ?? '25', 10) || 25);
    const key = escapeLike(normalise(q));
    const raw = escapeLike(q);

    // An exact tracking number is unambiguous — go straight there.
    // Everything else returns a list, even when it finds one, so the person
    // always sees what matched before being taken anywhere.
    const { data: exact, error: e1 } = await db.from('parcels')
        .select('*').eq('tracking_number', q).maybeSingle();
    if (e1) throw error(503, dbMessage(e1, 'Lookup failed'));
    if (exact) return json({ found: true, ...(await assemble(exact)) });

    /* ── which parcels match, and why ── */

    // by tracking or PO
    const { data: byParcel } = await db.from('parcels')
        .select('tracking_number')
        .or(`tracking_number.ilike.%${raw}%,po_number.ilike.%${raw}%,search_key.ilike.%${key}%`)
        .limit(500);

    // by order ID, ASIN or item name
    const { data: byItem } = await db.from('parcel_items')
        .select('tracking_number')
        .or(`order_id.ilike.%${raw}%,title.ilike.%${raw}%,asin.ilike.%${raw}%,search_key.ilike.%${key}%`)
        .limit(1000);

    const trackings = [...new Set([
        ...(byParcel ?? []).map(r => r.tracking_number),
        ...(byItem ?? []).map(r => r.tracking_number)
    ])];

    if (trackings.length === 0) return json({ found: false });

    // Newest order first, then a page of them. A brand name can match fifty
    // parcels; rendering all of them helps nobody.
    const { data: fan, count } = await db.from('parcels')
        .select('tracking_number,po_number,order_ids,carrier,item_count,order_date,order_on,delivery_on,shipment_date,delivery_state,warehouse_received,warehouse_received_at,attention_state,box_id',
                { count: 'exact' })
        .in('tracking_number', trackings)
        .order('order_on', { ascending: false, nullsFirst: false })
        .range(from, from + size - 1);

    const page = (fan ?? []).map(p => p.tracking_number);

    // Every matching line, not just the first. A parcel holding three
    // La Roche-Posay products should not look like one holding a single item.
    const { data: matched } = await db.from('parcel_items')
        .select('tracking_number,title,asin,quantity,order_id')
        .in('tracking_number', page.length ? page : ['—'])
        .or(`title.ilike.%${raw}%,asin.ilike.%${raw}%,order_id.ilike.%${raw}%`)
        .limit(500);

    const byTrk = new Map();
    for (const m of matched ?? []) {
        if (!byTrk.has(m.tracking_number)) byTrk.set(m.tracking_number, []);
        byTrk.get(m.tracking_number).push(m);
    }

    const rows = (fan ?? []).map(p => {
        const hits = byTrk.get(p.tracking_number) ?? [];
        return {
            ...p,
            matches: hits,
            // A PO or tracking hit has no item behind it — say so rather than
            // leaving the column blank and looking broken
            matchedOn: hits.length ? 'item' : 'parcel'
        };
    });

    return json({
        found: true,
        many: rows,
        total: count ?? trackings.length,
        from, size,
        more: (from + size) < (count ?? trackings.length),
        term: q
    });
}

/** Pull everything that touches one parcel. */
async function assemble(parcel) {
    const t = parcel.tracking_number;

    const [items, scans, box] = await Promise.all([
        db.from('parcel_items').select('*').eq('tracking_number', t),
        db.from('scan_log').select('*').eq('tracking_number', t).order('scanned_at', { ascending: true }),
        parcel.box_id
            ? db.from('boxes').select('*').eq('box_id', parcel.box_id).maybeSingle()
            : Promise.resolve({ data: null })
    ]);

    // Includes qty_reason, so a changed quantity carries its explanation here
    const packed = parcel.box_id
        ? (await db.from('box_items').select('*').eq('box_id', parcel.box_id).eq('tracking_number', t)).data ?? []
        : [];

    return {
        parcel,
        items: items.data ?? [],
        scans: scans.data ?? [],
        box: box.data ?? null,
        packed,
        // the item lines carry the settled marker, so the arc needs them
        stages: buildStages(parcel, scans.data ?? [], box.data, items.data ?? [])
    };
}

/**
 * The arc, as dated steps. A stage with no date is still listed — knowing
 * a parcel never reached a step is as useful as knowing when it did.
 */
function buildStages(p, scans, box, lines = []) {
    const firstScan = scans.find(s => s.action === 'received');

    /** Midnight UTC on a date, whichever shape the column arrives in. */
    const atMidnight = v => (v ? String(v).slice(0, 10) + 'T00:00:00Z' : null);

    // Bombino handle their own receiving, so a BM parcel never passes through
    // Jamaica; naming the stages for the right warehouse stops a normal BM
    // parcel looking like it went missing.

    // Bombino handle their own receiving, so a BM parcel never passes through
    // Jamaica — showing an empty "Scanned at Jamaica" makes a normal parcel
    // look neglected. And a parcel handled before this system existed was not
    // lost either; the manifest knows that, so the trace should too.
    const isBM = p.stream === 'bm';

    const settled = lines.find(i => i.settled_at) ?? null;
    const allSettled = lines.length > 0 && lines.every(i => i.settled_at);

    const stages = [
        {
            key: 'ordered', label: 'Ordered',
            at: atMidnight(p.order_on),
            dateOnly: true,
            note: p.po_number || ''
        },
        {
            key: 'shipped', label: 'Shipped',
            at: atMidnight(p.ship_date),
            dateOnly: true,
            note: p.carrier || ''
        },
        {
            key: 'delivered',
            label: isBM ? 'Delivered to Bombino' : 'Delivered to Jamaica',
            // Two sources, best first. `delivered_on` is observed — we watched
            // the parcel change between two uploads, so it is certain.
            // `delivery_on` is Amazon's date, which for a delivered parcel is
            // when it arrived: of 3,096 delivered rows in the real report,
            // 3,095 had already passed.
            at: atMidnight(p.delivered_on ?? p.delivery_on),
            dateOnly: true,
            reached: p.delivery_state === 'delivered',
            note: p.delivered_on
                ? 'seen between two reports'
                : (p.delivery_on
                    ? (p.delivery_state === 'delivered' ? 'from the report' : 'expected')
                    : (p.delivery_status_raw || ''))
        },
        {
            key: 'scanned',
            label: 'Scanned at Jamaica',
            at: p.warehouse_received_at ?? firstScan?.scanned_at ?? null,
            // Bombino do not scan, so arrival is inferred from the carrier
            // rather than from a scan that will never exist
            note: p.warehouse_received_by || ''
        },
        {
            key: 'boxed', label: 'Packed into a box',
            at: p.boxed_at,
            note: p.box_id || ''
        },
        {
            key: 'closed', label: 'Box closed',
            at: box?.closed_at ?? null,
            note: box?.packer_name || ''
        }
    ];

    // Replace the two packing stages for a parcel that went out by hand before
    // this system existed — it was never packed here, and saying so is more
    // honest than leaving the stages blank.
    // Bombino receive their own parcels, so delivery and receipt are the same
    // event — two stages saying it would read as a step that never happened.
    const out = isBM ? stages.filter(s => s.key !== 'scanned') : stages;

    // A parcel that went out by hand before this system existed was never
    // packed here. Saying so beats leaving the packing stages blank.
    if (isBM && allSettled) {
        const from = out.findIndex(s => s.key === 'boxed');
        if (from !== -1) {
            out.splice(from, out.length - from, {
                key: 'sent_before',
                label: 'Sent before this system',
                at: settled.settled_at,
                note: settled.settled_by
                    ? `marked by ${settled.settled_by}${settled.settled_note ? ` — ${settled.settled_note}` : ''}`
                    : (settled.settled_note || '')
            });
        }
    }

    // Gap from the previous stage that actually happened
    let prev = null;
    for (const st of out) {
        st.reached = st.reached ?? !!st.at;
        if (st.at && prev) {
            const days = Math.round((new Date(st.at) - new Date(prev)) / 864e5);
            st.gapDays = days >= 0 ? days : null;
        }
        if (st.at) prev = st.at;
    }
    return out;
}
