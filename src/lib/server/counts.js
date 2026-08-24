import { db } from '$lib/server/db.js';

/** The four numbers every screen leans on. Parcels an admin has already
 *  settled in Need Attention drop out of the working counts. */
export async function parcelCounts(stream = 'dropy') {
    const head = { count: 'exact', head: true };
    // Every count is scoped to one warehouse
    const base = () => db.from('parcels').select('*', head).eq('stream', stream);
    const [all, ok, transit, missing, notDel, attention] = await Promise.all([
        base(),
        base().eq('warehouse_received', true),
        base().eq('warehouse_received', false).eq('delivery_state', 'in_transit').is('attention_state', null),
        base().eq('warehouse_received', false).eq('delivery_state', 'delivered').is('attention_state', null),
        base().eq('warehouse_received', false).eq('delivery_state', 'not_delivered').is('attention_state', null),
        base().not('attention_state', 'is', null)
    ]);
    return {
        all: all.count ?? 0,
        ok: ok.count ?? 0,
        hold: transit.count ?? 0,
        bad: missing.count ?? 0,
        notDelivered: notDel.count ?? 0,
        attention: attention.count ?? 0
    };
}
