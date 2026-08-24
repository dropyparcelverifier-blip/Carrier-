import Papa from 'papaparse';

/** Amazon exports sometimes wrap long numeric IDs as ="0123..." to stop Excel
 *  mangling them. Strip that so a scanned barcode matches the stored value. */
export function clean(v) {
    let s = String(v ?? '').trim();
    if (s.startsWith('="') && s.endsWith('"')) s = s.slice(2, -1);
    else if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
    s = s.trim();
    return (s === 'N/A' || s === '-') ? '' : s;
}

/** Amazon dates are MM/DD/YYYY text. Convert to ISO so the database can
 *  sort and filter them as dates rather than strings. */
export function toISO(v) {
    const s = clean(v);
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (!m) return null;
    const [, mm, dd, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/** The carrier's wording, reduced to something we can filter on.
 *  "Not Delivered" used to look identical to in-transit, which left those
 *  parcels sitting in the awaited pile indefinitely. */
export function deliveryState(raw) {
    const s = clean(raw).toLowerCase();
    if (s === 'delivered') return 'delivered';
    if (s === 'not delivered') return 'not_delivered';
    if (!s || s === 'n/a') return 'unknown';
    return 'in_transit';
}

/**
 * Which warehouse an address belongs to.
 *
 * Anything mentioning Dropy is Abhi's. Bombino goes by several spellings —
 * Costech, Costeck, with and without the dash — so it is matched loosely.
 * Anything else is neither and is left out entirely.
 */
export function streamOf(address) {
    const a = String(address ?? '').toLowerCase();
    if (!a) return null;
    if (a.includes('dropy')) return 'dropy';
    if (a.includes('bombino') || a.includes('costech') || a.includes('costeck')) return 'bm';
    return null;
}

/**
 * Read an Amazon Business report and pull out Dropy parcels, one per tracking number.
 * Returns { kind, total_csv_rows, dropy_rows, parcels, items, covers }.
 * kind is 'shipment' when the file carries tracking numbers, otherwise 'order'.
 */
export function parseAmazonCSV(csvText) {
    const { data, meta, errors } = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: h => h.trim()
    });

    if (errors.length && !data.length) {
        throw new Error(errors[0].message);
    }

    const cols = meta.fields || [];
    const hasTracking = cols.includes('Carrier Tracking #');
    const hasAddress = cols.includes('Shipping Address');

    // Order reports carry no tracking or address columns, so there is
    // no parcel to build from them.
    if (!hasTracking || !hasAddress) {
        return { kind: 'order', total_csv_rows: data.length, dropy_rows: 0, parcels: [], items: [], covers: null };
    }

    // Both warehouses come through the same report. The address is the only
    // reliable split — the PO prefix says nothing, since 584 of Bombino's
    // parcels carry a Dropy- PO.
    const ours = data
        .map(r => ({ row: r, stream: streamOf(clean(r['Shipping Address'])) }))
        .filter(x => x.stream !== null);

    const byTracking = new Map();
    const items = [];
    const seenItem = new Set();

    const num = v => {
        const n = parseFloat(clean(v).replace(/[$,]/g, ''));
        return Number.isFinite(n) ? n : null;
    };

    for (const { row, stream } of ours) {
        const tracking = clean(row['Carrier Tracking #']);
        if (!tracking) continue;

        const orderId = clean(row['Order ID']);
        const po = clean(row['PO Number']);
        const asin = clean(row['ASIN']);

        // One row per line item — Phase 2 box logs need description and value
        const key = `${tracking}|${orderId}|${asin}`;
        if (!seenItem.has(key)) {
            seenItem.add(key);
            items.push({
                tracking_number: tracking,
                order_id: orderId,
                po_number: po,
                asin,
                title: clean(row['Title']),
                brand: clean(row['Brand']),
                manufacturer: clean(row['Manufacturer']),
                part_number: clean(row['Part number']),
                condition: clean(row['Product Condition']),
                category: clean(row['Amazon-Internal Product Category']),
                unspsc: clean(row['UNSPSC']),
                seller_name: clean(row['Seller Name']),
                order_date: clean(row['Order Date']),
                quantity: parseInt(clean(row['Item Quantity']), 10) || 1,
                unit_price: num(row['Purchase PPU']),
                item_tax: num(row['Item Tax']),
                item_total: num(row['Item Net Total'])
            });
        }

        const hit = byTracking.get(tracking);
        if (hit) {
            hit.item_count += 1;
            if (orderId && !hit.order_ids.includes(orderId)) hit.order_ids.push(orderId);
            if (po && !hit.po_number) hit.po_number = po;
        } else {
            const rawStatus = clean(row['Delivery Status']);
            const state = deliveryState(rawStatus);
            const shipDate = clean(row['Shipment Date']);
            const expected = clean(row['Expected Delivery Date']);
            const orderDate = clean(row['Order Date']);
            byTracking.set(tracking, {
                tracking_number: tracking,
                stream,
                carrier: clean(row['Carrier Name']),
                shipment_date: shipDate,
                // Amazon's expected delivery date. For a parcel marked
                // delivered this is when it arrived — checked against 3,096
                // delivered rows, 3,095 of which had already passed.
                expected_delivery: expected,
                delivery_on: toISO(expected),
                ship_date: toISO(shipDate),
                order_date: orderDate,
                order_on: toISO(orderDate) ?? toISO(shipDate),
                item_count: 1,
                order_ids: orderId ? [orderId] : [],
                po_number: po,
                shipping_address: clean(row['Shipping Address']),
                delivery_status_raw: rawStatus,
                delivery_state: state,
                amazon_delivered: state === 'delivered',
                amazon_delivered_date: state === 'delivered' ? shipDate : null
            });
        }
    }

    // Date span this report covers — feeds the upload calendar
    const dates = Array.from(byTracking.values())
        .map(p => p.ship_date).filter(Boolean).sort();

    return {
        kind: 'shipment',
        total_csv_rows: data.length,
        dropy_rows: ours.filter(x => x.stream === 'dropy').length,
        bm_rows: ours.filter(x => x.stream === 'bm').length,
        parcels: Array.from(byTracking.values()),
        items,
        covers: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null
    };
}
