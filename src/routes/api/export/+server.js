import { error } from '@sveltejs/kit';
import * as XLSX from 'xlsx';
import { db, fetchAll } from '$lib/server/db.js';
import { streamOf } from '$lib/server/stream.js';
import { looseFilter } from '$lib/server/search.js';

/**
 * Real .xlsx, not CSV.
 *
 * A tracking number like 9400151904209902248076 is 22 digits. Excel reads a
 * CSV column of those as a number and renders 9.40015E+21, destroying it.
 * Writing xlsx directly lets every identifier be typed as text, so what
 * lands in the recipient's hands is what we exported.
 */

const asText = v => ({ v: String(v ?? ''), t: 's' });
// A cell written as numeric must actually hold a number. Number('N/A') is
// NaN, and a NaN in the XML makes the whole workbook unopenable — so an
// unparseable value becomes a blank rather than breaking the file.
const asNum = v => {
    if (v == null || v === '') return { v: '', t: 's' };
    const n = Number(v);
    return Number.isFinite(n) ? { v: n, t: 'n' } : { v: '', t: 's' };
};

function sheetFrom(headers, rows, widths) {
    const ws = {};
    const range = { s: { c: 0, r: 0 }, e: { c: headers.length - 1, r: rows.length } };

    headers.forEach((h, c) => {
        ws[XLSX.utils.encode_cell({ c, r: 0 })] = {
            v: h, t: 's',
            s: { font: { bold: true } }
        };
    });

    rows.forEach((row, r) => {
        row.forEach((cell, c) => {
            ws[XLSX.utils.encode_cell({ c, r: r + 1 })] = cell;
        });
    });

    ws['!ref'] = XLSX.utils.encode_range(range);
    ws['!cols'] = widths.map(w => ({ wch: w }));
    ws['!autofilter'] = { ref: ws['!ref'] };
    return ws;
}

export async function GET({ url, locals }) {
    // No rates in this sheet — tracking numbers, dates and statuses — so the
    // cargo team can pull their own list. The box file is the one that carries
    // prices, and it checks for admin in its own handler.
    const what = url.searchParams.get('what') ?? 'delayed';
    const day = url.searchParams.get('day');
    const days = Math.max(1, parseInt(url.searchParams.get('days') ?? '3', 10) || 3);

    const COLS = 'tracking_number,po_number,order_ids,carrier,item_count,order_date,order_on,delivery_on,'
               + 'shipment_date,ship_date,delivery_state,delivery_status_raw,'
               + 'warehouse_received,warehouse_received_at,attention_state,box_id';

    // The filters are recorded rather than applied, because a range cannot be
    // added to a query that already carries one — and paging is the only way
    // to get past Supabase's 1,000-row response cap. A truncated export is
    // worse than no export: it looks complete.
    const steps = [];
    // reassigned by the filter blocks below, so `let`
    let sel = new Proxy({}, {
        get: (_, method) => (...args) => { steps.push([method, args]); return sel; }
    });

    let title = 'Parcels';
    let filename = 'parcels';

    if (what === 'delayed') {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const iso = cutoff.toISOString().slice(0, 10);

        sel = sel.eq('delivery_state', 'delivered')
                 .eq('warehouse_received', false)
                 .is('attention_state', null)
                 .lt('order_on', iso)
                 .order('order_on', { ascending: true });

        title = `Delayed over ${days} days`;
        filename = `delayed-${days}d-${new Date().toISOString().slice(0, 10)}`;

    } else if (what === 'missing') {
        sel = sel.eq('delivery_state', 'delivered')
                 .eq('warehouse_received', false)
                 .is('attention_state', null)
                 .order('order_on', { ascending: true });
        title = 'Missing';
        filename = `missing-${new Date().toISOString().slice(0, 10)}`;

    } else if (what === 'day' && day) {
        sel = sel.eq('order_on', day).order('tracking_number');
        title = `Ordered ${day}`;
        filename = `ordered-${day}`;

    } else if (what === 'hold') {
        // What is on the overview, with the same filter applied. An export
        // that quietly ignores the filter is worse than no export.
        sel = sel.eq('delivery_state', 'delivered')
                 .eq('warehouse_received', false)
                 .is('box_id', null)
                 .not('delivery_on', 'is', null)
                 .order('delivery_on');
        // The hold filter, applied in SQL so the sheet matches the screen
        const op = url.searchParams.get('op');
        const n = parseInt(url.searchParams.get('days') ?? '', 10);
        if (Number.isFinite(n)) {
            const cut = new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
            if (op === 'over') sel = sel.lt('delivery_on', cut);
            else if (op === 'under') sel = sel.gt('delivery_on', cut);
            else if (op === 'exactly') sel = sel.eq('delivery_on', cut);
        }
        const q = (url.searchParams.get('q') ?? '').trim();
        if (q) sel = sel.or(looseFilter(q));

        title = 'Waiting to be scanned';
        filename = 'waiting-to-scan';

    } else if (what === 'day_missing' && day) {
        sel = sel.eq('order_on', day)
                 .eq('warehouse_received', false)
                 .order('tracking_number');
        title = `Missing ${day}`;
        filename = `missing-${day}`;

    } else if (what === 'day_received' && day) {
        sel = sel.eq('order_on', day)
                 .eq('warehouse_received', true)
                 .order('warehouse_received_at');
        title = `Received ${day}`;
        filename = `received-${day}`;

    } else if (what === 'attention') {
        sel = sel.in('delivery_state', ['not_delivered', 'unknown'])
                 .eq('warehouse_received', false)
                 .is('attention_state', null)
                 .order('order_on', { ascending: true });
        title = 'Need attention';
        filename = `attention-${new Date().toISOString().slice(0, 10)}`;
    }

    const build = () => steps.reduce(
        (q, [method, args]) => q[method](...args),
        db.from('parcels').select(COLS).eq('stream', streamOf(url))
    );

    const { data, error: e } = await fetchAll(build);
    if (e) throw error(503, 'Could not build the export');

    const rows = (data ?? []).map(p => {
        const basis = p.order_on ?? p.ship_date;
        const age = basis
            ? Math.max(0, Math.floor((Date.now() - new Date(basis + 'T00:00:00Z')) / 864e5))
            : '';
        // Days since it reached the warehouse — the number the overview
        // sorts on, so the sheet has to carry it or the export is a different
        // list from the one on screen.
        const hold = p.delivery_on
            ? Math.max(0, Math.floor((Date.now() - new Date(String(p.delivery_on).slice(0,10) + 'T00:00:00Z')) / 864e5))
            : '';

        return [
            asText(p.tracking_number),     // text — this is the whole point
            asText(p.po_number),
            asText((p.order_ids ?? []).join(', ')),
            asText(p.delivery_on ? String(p.delivery_on).slice(0, 10) : ''),
            asNum(hold),
            asText(p.carrier),
            asNum(p.item_count),
            asText(p.order_date),
            asText(p.shipment_date),
            asNum(age),
            asText(p.delivery_status_raw || p.delivery_state),
            asText(p.warehouse_received ? 'Yes' : 'No'),
            asText(p.warehouse_received_at
                ? new Date(p.warehouse_received_at).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' })
                : ''),
            asText(p.box_id)
        ];
    });

    const ws = sheetFrom(
        ['Tracking', 'PO', 'Order IDs', 'Delivered', 'Hold days', 'Carrier', 'Pcs',
         'Ordered', 'Shipped', 'Days open', 'Carrier status', 'Scanned in',
         'Scanned at (IST)', 'Box'],
        rows,
        [26, 14, 24, 12, 10, 20, 6, 12, 12, 11, 16, 12, 20, 18]
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buf, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}.xlsx"`
        }
    });
}
