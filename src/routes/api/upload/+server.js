import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';

/** History for the intake screen. */
export async function GET() {
    const [{ data: history }, { count }] = await Promise.all([
        db.from('uploads').select('*').order('uploaded_at', { ascending: false }).limit(15),
        db.from('parcels').select('*', { count: 'exact', head: true })
    ]);
    return json({ history: history ?? [], onFile: count ?? 0 });
}

/**
 * Takes parcels and items already parsed in the browser and writes them.
 * The CSV never leaves the client, only the extracted rows, and every
 * write is checked so a dropped chunk is reported rather than lost.
 */
export async function POST({ request, locals }) {
    let body;
    try { body = await request.json(); } catch { throw error(400, 'Bad request'); }

    const parcels = Array.isArray(body?.parcels) ? body.parcels : [];
    const items = Array.isArray(body?.items) ? body.items : [];
    const filename = String(body?.filename ?? 'report.csv').slice(0, 200);
    const covers = body?.covers ?? null;
    const who = locals.user.display_name || locals.user.username;

    if (!parcels.length && !items.length) {
        return json({ added: 0, updated: 0, itemsWritten: 0, writeErrors: 0 });
    }

    // The parser tags each parcel; count them here for the receipt
    const dropyRows = parcels.filter(p => p.stream !== 'bm').length;
    const bmRows = parcels.filter(p => p.stream === 'bm').length;

    let added = 0, updated = 0, itemsWritten = 0, writeErrors = 0, observedDeliveries = 0;
    let itemError = '';

    // What's already on file
    const known = new Map();
    const keys = parcels.map(p => p.tracking_number);
    for (let i = 0; i < keys.length; i += 400) {
        const { data } = await db.from('parcels')
            .select('tracking_number,item_count,po_number,delivery_state,delivered_on,delivery_on,order_on,order_ids')
            .in('tracking_number', keys.slice(i, i + 400));
        (data ?? []).forEach(r => known.set(r.tracking_number, r));
    }

    // Today in IST — the upload happens from India, so "the day we saw it"
    // is that calendar day.
    const seenOn = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());

    const fresh = [], touch = [];
    for (const p of parcels) {
        const old = known.get(p.tracking_number);
        if (!old) {
            fresh.push({
                tracking_number: p.tracking_number,
                carrier: p.carrier,
                stream: p.stream,
                shipment_date: p.shipment_date,
                expected_delivery: p.expected_delivery,
                delivery_on: p.delivery_on,
                ship_date: p.ship_date,
                order_date: p.order_date,
                order_on: p.order_on,
                item_count: p.item_count,
                order_ids: p.order_ids,
                po_number: p.po_number,
                shipping_address: p.shipping_address,
                delivery_status_raw: p.delivery_status_raw,
                delivery_state: p.delivery_state,
                amazon_delivered: p.amazon_delivered,
                amazon_delivered_date: p.amazon_delivered_date,
                status: p.amazon_delivered ? 'delivered' : 'shipped',
                // Already delivered the first time we saw it. Amazon's export
                // has no delivery date, so we genuinely don't know — and a
                // guess here would read as fact on every screen.
                delivered_on: null,
                delivered_on_source: null
            });
        } else if (p.delivery_state !== old.delivery_state
                || p.item_count !== old.item_count
                || (p.po_number && p.po_number !== old.po_number)
                // A field the parcel has never carried is a change too. This
                // test used to look only at status, count and PO, so when a
                // new column arrived every existing parcel was skipped and
                // the column stayed empty however many times you re-uploaded.
                || (p.delivery_on && !old.delivery_on)
                || (p.order_on && !old.order_on)
                || (p.order_ids?.length && !old.order_ids?.length)) {
            // We watched this one flip to delivered — that is a real date
            const justDelivered = p.delivery_state === 'delivered'
                               && old.delivery_state !== 'delivered'
                               && !old.delivered_on;
            touch.push({ ...p, _observed: justDelivered });
        }
    }

    for (let i = 0; i < fresh.length; i += 300) {
        const chunk = fresh.slice(i, i + 300);
        const { error: e } = await db.from('parcels').insert(chunk);
        if (e) writeErrors += chunk.length; else added += chunk.length;
    }

    for (const p of touch) {
        const patch = {
            item_count: p.item_count,
            delivery_state: p.delivery_state,
            delivery_status_raw: p.delivery_status_raw,
            amazon_delivered: p.amazon_delivered,
            updated_at: new Date().toISOString()
        };
        if (p.po_number) patch.po_number = p.po_number;
        if (p.ship_date) patch.ship_date = p.ship_date;
        // Backfills the delivery date on parcels already on file — it was
        // never captured before, so every existing row needs it once.
        if (p.delivery_on) {
            patch.expected_delivery = p.expected_delivery;
            patch.delivery_on = p.delivery_on;
        }
        if (p.order_on) { patch.order_date = p.order_date; patch.order_on = p.order_on; }
        if (p.amazon_delivered) patch.amazon_delivered_date = p.amazon_delivered_date;
        if (p._observed) {
            patch.delivered_on = seenOn;
            patch.delivered_on_source = 'observed';
            observedDeliveries++;
        }

        const { error: e } = await db.from('parcels').update(patch).eq('tracking_number', p.tracking_number);
        if (e) writeErrors++; else updated++;
    }

    for (let i = 0; i < items.length; i += 300) {
        const chunk = items.slice(i, i + 300);
        const { error: e } = await db.from('parcel_items')
            .upsert(chunk, { onConflict: 'tracking_number,order_id,asin', ignoreDuplicates: false });
        if (e) itemError = e.message; else itemsWritten += chunk.length;
    }

    // A parcel scanned before its report arrived is already on the shelf.
    // Mark it received, dated to the scan rather than to this upload.
    let backdated = 0;
    const { data: fixed } = await db.rpc('reconcile_unmatched_scans');
    if (typeof fixed === 'number') backdated = fixed;

    await db.from('uploads').insert({
        filename,
        parcels_added: added,
        parcels_updated: updated,
        items_written: itemsWritten,
        covers_from: covers?.from ?? null,
        covers_to: covers?.to ?? null,
        uploaded_by: who
    });

    const { count } = await db.from('parcels').select('*', { count: 'exact', head: true });

    return json({ added, updated, itemsWritten, writeErrors, itemError, backdated,
                  observedDeliveries, dropyRows, bmRows, onFile: count ?? 0 });
}
