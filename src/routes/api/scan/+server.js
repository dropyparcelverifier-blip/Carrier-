import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { parcelCounts } from '$lib/server/counts.js';

export async function GET({ url }) {
    const counts = await parcelCounts();
    const limit = Math.min(300, parseInt(url.searchParams.get('limit') ?? '120', 10) || 120);

    // "Today" is the cargo team's day, not the server's
    const et = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    const dayStart = new Date(`${et}T00:00:00-04:00`).toISOString();

    const [{ data: scans }, { data: todayScans }] = await Promise.all([
        db.from('scan_log')
            .select('tracking_number,scanned_at,scanned_by')
            .eq('action', 'received')
            .order('scanned_at', { ascending: false })
            .limit(limit),
        db.from('scan_log')
            .select('tracking_number,scanned_at,scanned_by')
            .eq('action', 'received')
            .gte('scanned_at', dayStart)
            .order('scanned_at', { ascending: false })
            .limit(200)
    ]);

    // Pending, split by age. The team never reads a list of fifty — a count
    // they can tap through to the calendar is what actually gets used.
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const iso = d => d.toISOString().slice(0, 10);
    const yday = new Date(today); yday.setDate(yday.getDate() - 1);

    const head = { count: 'exact', head: true };
    const base = () => db.from('parcels').select('*', head)
        .eq('warehouse_received', false)
        .eq('delivery_state', 'delivered')
        .is('attention_state', null);

    const [t, y, all] = await Promise.all([
        base().eq('order_on', iso(today)),
        base().eq('order_on', iso(yday)),
        base()
    ]);

    const pending = {
        total: all.count ?? 0,
        today: t.count ?? 0,
        yesterday: y.count ?? 0,
        older: Math.max(0, (all.count ?? 0) - (t.count ?? 0) - (y.count ?? 0))
    };

    return json({
        counts,
        recent: scans ?? [],
        todayList: todayScans ?? [],
        today: (todayScans ?? []).length,
        pending
    });
}
