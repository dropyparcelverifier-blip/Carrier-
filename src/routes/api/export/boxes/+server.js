import { error } from '@sveltejs/kit';
import * as XLSX from 'xlsx';
import { db } from '$lib/server/db.js';

/**
 * The daily box file.
 *
 * One sheet covering every box closed on a given day, in the column shape the
 * customs paperwork expects. Written as real .xlsx rather than CSV because an
 * SKU like 37000937555 becomes 3.70009E+10 the moment Excel reads it from a
 * text file.
 */

const asText = v => ({ v: String(v ?? ''), t: 's' });
// A NaN written as a numeric cell makes the workbook unopenable. This file
// goes to customs, so an unreadable one is worse than a blank cell.
const asNum = v => {
    if (v == null || v === '') return { v: '', t: 's' };
    const n = Number(v);
    return Number.isFinite(n) ? { v: n, t: 'n' } : { v: '', t: 's' };
};

export async function GET({ url, locals }) {
    // Only an admin may generate these — they carry rates
    if (locals.user.role !== 'admin') throw error(403, 'Admins only');

    const day = url.searchParams.get('day');
    const one = url.searchParams.get('box');

    if (!day && !one) throw error(400, 'Give a day or a box');
    if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw error(400, 'Give a day as YYYY-MM-DD');

    let sel = db.from('boxes')
        .select('box_id,packer_name,filled_weight,empty_weight,net_weight,closed_at')
        .eq('status', 'closed');

    if (one) {
        sel = sel.eq('box_id', one);
    } else {
        // Counted in IST, since that is where packing happens
        sel = sel.gte('closed_at', `${day}T00:00:00+05:30`)
                 .lte('closed_at', `${day}T23:59:59.999+05:30`);
    }

    const { data: boxes, error: e1 } = await sel.order('box_id');

    if (e1) throw error(503, 'Could not read the boxes');
    if (!boxes?.length) throw error(404, one ? 'That box is not closed' : 'No boxes were closed that day');

    const ids = boxes.map(b => b.box_id);

    const { data: items, error: e2 } = await db.from('box_items')
        .select('box_id,tracking_number,po_number,asin,title,qty_actual,weight_g,unit_price')
        .in('box_id', ids)
        .order('box_id')
        .order('packed_at');

    if (e2) throw error(503, 'Could not read the contents');

    /* ── contents sheet ── */
    const headers = ['Source', 'Item name', 'SKU', 'Qty', 'Category', 'Per Product Wt', 'Product Rate USD'];
    const widths = [18, 58, 18, 7, 15, 16, 17];

    const rows = (items ?? []).map(it => ([
        asText(it.box_id),        // Source — which box it came out of
        asText(it.title),         // Item name
        asText(it.asin),          // SKU — text, or Excel mangles long digits
        asNum(it.qty_actual),     // Qty
        asText(it.po_number),     // Category
        asNum(it.weight_g),       // Per Product Wt — one unit
        asNum(it.unit_price)      // Product Rate USD
    ]));

    const ws = sheet(headers, rows, widths);

    /* ── summary sheet, so the totals travel with the file ── */
    const perBox = boxes.map(b => {
        const own = (items ?? []).filter(i => i.box_id === b.box_id);
        const units = own.reduce((s, i) => s + (Number(i.qty_actual) || 0), 0);
        // weight_g is per unit, so a line weighs qty × weight
        const grams = own.reduce((s, i) => s + (Number(i.weight_g) || 0) * (Number(i.qty_actual) || 0), 0);
        const value = own.reduce((s, i) => s + (Number(i.unit_price) || 0) * (Number(i.qty_actual) || 0), 0);
        return [
            asText(b.box_id),
            asText(b.packer_name),
            asNum(new Set(own.map(i => i.tracking_number)).size),
            asNum(units),
            asNum(b.filled_weight),
            asNum(b.empty_weight),
            asNum(b.net_weight),
            asNum(+(grams / 1000).toFixed(3)),
            asNum(+value.toFixed(2))
        ];
    });

    const totals = [
        asText('TOTAL'), asText(''),
        asNum(perBox.reduce((s, r) => s + (r[2].v || 0), 0)),
        asNum(perBox.reduce((s, r) => s + (r[3].v || 0), 0)),
        asNum(+perBox.reduce((s, r) => s + (r[4].v || 0), 0).toFixed(3)),
        asNum(+perBox.reduce((s, r) => s + (r[5].v || 0), 0).toFixed(3)),
        asNum(+perBox.reduce((s, r) => s + (r[6].v || 0), 0).toFixed(3)),
        asNum(+perBox.reduce((s, r) => s + (r[7].v || 0), 0).toFixed(3)),
        asNum(+perBox.reduce((s, r) => s + (r[8].v || 0), 0).toFixed(2))
    ];

    const ws2 = sheet(
        ['Box', 'Packer', 'Parcels', 'Units', 'Full kg', 'Empty kg', 'Net kg', 'Contents kg', 'Value USD'],
        [...perBox, totals],
        [22, 16, 9, 8, 10, 10, 10, 13, 12]
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contents');
    // A per-box summary only earns its place when there are several boxes
    if (boxes.length > 1) XLSX.utils.book_append_sheet(wb, ws2, 'Boxes');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const name = one ? `box-${one.replace(/[^\w.-]+/g, '-')}` : `box-file-${day}`;

    return new Response(buf, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${name}.xlsx"`
        }
    });
}

function sheet(headers, rows, widths) {
    const ws = {};
    headers.forEach((h, c) => {
        ws[XLSX.utils.encode_cell({ c, r: 0 })] = { v: h, t: 's', s: { font: { bold: true } } };
    });
    rows.forEach((row, r) => {
        row.forEach((cell, c) => {
            ws[XLSX.utils.encode_cell({ c, r: r + 1 })] = cell;
        });
    });
    ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: headers.length - 1, r: rows.length } });
    ws['!cols'] = widths.map(w => ({ wch: w }));
    ws['!autofilter'] = { ref: ws['!ref'] };
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    return ws;
}
