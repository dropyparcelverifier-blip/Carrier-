import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { dbMessage } from '$lib/server/dberror.js';

const SETTING_KEYS = ['attention_quiet_days'];

export async function GET() {
    const [team, users, settings] = await Promise.all([
        db.from('team_members').select('id,name,role,active').order('active', { ascending: false }).order('name'),
        // pin_hash is never selected, so it cannot leak through this endpoint
        db.from('app_users').select('username,role,display_name,active').order('role').order('username'),
        db.from('app_settings').select('key,value').in('key', SETTING_KEYS)
    ]);

    if (team.error) throw error(503, dbMessage(team.error, 'Could not load settings'));

    const s = {};
    (settings.data ?? []).forEach(r => { s[r.key] = r.value; });

    return json({
        team: team.data ?? [],
        users: users.data ?? [],
        settings: s
    });
}

export async function POST({ request, locals }) {
    if (locals.user.role !== 'admin') throw error(403, 'Admins only');

    let body;
    try { body = await request.json(); } catch { throw error(400, 'Bad request'); }

    const action = body?.action;

    /* ── packers in the box dropdown ── */
    if (action === 'add_member') {
        const name = String(body?.name ?? '').trim();
        if (!name) throw error(400, 'Name required');
        if (name.length > 60) throw error(400, 'Name too long');

        const { error: e } = await db.from('team_members')
            .upsert({ name, role: 'packer', active: true }, { onConflict: 'name' });
        if (e) throw error(503, dbMessage(e, 'Could not add'));
        return json({ ok: true });
    }

    if (action === 'set_member_active') {
        const id = Number(body?.id);
        if (!Number.isFinite(id)) throw error(400, 'Bad id');
        const { error: e } = await db.from('team_members')
            .update({ active: !!body?.active }).eq('id', id);
        if (e) throw error(503, dbMessage(e, 'Could not update'));
        return json({ ok: true });
    }

    /* ── login accounts ──
       PINs go through the database functions so hashing happens there
       and no plaintext is ever stored. */
    if (action === 'add_user') {
        const username = String(body?.username ?? '').trim().toLowerCase();
        const pin = String(body?.pin ?? '').trim();
        const role = String(body?.role ?? '').trim();
        const display = String(body?.display_name ?? '').trim();

        if (!/^[a-z0-9_.-]{2,32}$/.test(username)) throw error(400, 'Username: letters, numbers, dot, dash or underscore');
        if (!/^\d{4}$/.test(pin)) throw error(400, 'PIN must be exactly 4 digits');
        if (!['cargo', 'packer', 'admin'].includes(role)) throw error(400, 'Pick a role');

        const { data, error: e } = await db.rpc('add_user', {
            p_username: username, p_pin: pin, p_role: role, p_display: display
        });
        if (e) throw error(503, dbMessage(e, 'Could not add the user'));
        return json({ ok: true, message: data });
    }

    if (action === 'set_pin') {
        const username = String(body?.username ?? '').trim().toLowerCase();
        const pin = String(body?.pin ?? '').trim();
        if (!/^\d{4}$/.test(pin)) throw error(400, 'PIN must be exactly 4 digits');

        const { data, error: e } = await db.rpc('set_user_pin', { p_username: username, p_pin: pin });
        if (e) throw error(503, dbMessage(e, 'Could not change the PIN'));
        return json({ ok: true, message: data });
    }

    if (action === 'set_user_active') {
        const username = String(body?.username ?? '').trim().toLowerCase();
        if (username === locals.user.username && body?.active === false) {
            throw error(400, 'You cannot deactivate your own account');
        }
        const { error: e } = await db.from('app_users')
            .update({ active: !!body?.active }).eq('username', username);
        if (e) throw error(503, dbMessage(e, 'Could not update'));
        return json({ ok: true });
    }

    /* ── thresholds ── */
    if (action === 'set_setting') {
        const key = String(body?.key ?? '');
        if (!SETTING_KEYS.includes(key)) throw error(400, 'Unknown setting');

        const value = String(body?.value ?? '').trim();
        if (key === 'attention_quiet_days') {
            const n = parseInt(value, 10);
            if (!Number.isFinite(n) || n < 1 || n > 60) throw error(400, 'Give a number between 1 and 60');
        }

        const { error: e } = await db.from('app_settings')
            .upsert({ key, value }, { onConflict: 'key' });
        if (e) throw error(503, dbMessage(e, 'Could not save'));
        return json({ ok: true });
    }

    throw error(400, 'Unknown action');
}
