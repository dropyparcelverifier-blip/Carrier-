import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { streamOf } from '$lib/server/stream.js';

export async function GET({ url }) {
    const stream = streamOf(url);
    const [{ data: boxes }, { data: team }, { data: days }] = await Promise.all([
        db.from('box_summary').select('*').eq('stream', stream).order('created_at', { ascending: false }).limit(300),
        db.from('team_members').select('name').eq('active', true).order('name'),
        db.from('box_days').select('*').eq('stream', stream).order('day', { ascending: false }).limit(90)
    ]);
    return json({
        boxes: boxes ?? [],
        packers: (team ?? []).map(t => t.name),
        days: days ?? []
    });
}

export async function POST({ request, locals }) {
    let body;
    try { body = await request.json(); } catch { throw error(400, 'Bad request'); }

    const boxId = String(body?.box_id ?? '').trim();
    const packer = String(body?.packer_name ?? '').trim();
    const filled = Number(body?.filled_weight);

    if (!boxId) throw error(400, 'Box number required');
    if (!packer) throw error(400, 'Packer required');
    if (!Number.isFinite(filled) || filled <= 0) throw error(400, 'Full weight required');

    const who = locals.user.display_name || locals.user.username;

    const { error: e } = await db.from('boxes').insert({
        box_id: boxId,
        packer_name: packer,
        filled_weight: filled,
        // Which warehouse. A BM box holds item lines; an Abhi box holds
        // whole parcels, and the packing screen branches on this.
        stream: body?.stream === 'bm' ? 'bm' : 'dropy',
        status: 'open',
        created_by: who,
        opened_by: who
    });

    if (e) {
        if (e.code === '23505') throw error(409, 'That box number already exists');
        throw error(503, 'Could not create the box');
    }

    return json({ ok: true, box_id: boxId });
}
