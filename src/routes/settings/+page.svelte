<script>
    import { onMount } from 'svelte';
    import { role, who, showToast } from '$lib/stores.js';
    import * as api from '$lib/api.js';

    let r = $state('none');
    let me = $state('');
    let loading = $state(true);
    let busy = $state('');
    let tab = $state('team');

    let team = $state([]);
    let users = $state([]);
    let settings = $state({});

    // forms
    let newPacker = $state('');
    let uName = $state('');
    let uPin = $state('');
    let uRole = $state('packer');
    let uDisplay = $state('');
    let pinFor = $state('');
    let newPin = $state('');
    let quietDays = $state('5');

    role.subscribe(v => r = v);
    who.subscribe(v => me = v);

    onMount(load);

    async function load() {
        loading = true;
        const out = await api.getSettings();
        loading = false;
        if (!out.ok) { showToast(out.message || 'Could not load', 'err'); return; }
        team = out.data.team;
        users = out.data.users;
        settings = out.data.settings;
        quietDays = settings.attention_quiet_days ?? '5';
    }

    async function run(payload, okMsg, tag) {
        busy = tag;
        const out = await api.saveSetting(payload);
        busy = '';
        if (!out.ok) { showToast(out.message || 'Could not save', 'err'); return false; }
        showToast(out.data?.message || okMsg, 'ok');
        await load();
        return true;
    }

    async function addPacker() {
        const name = newPacker.trim();
        if (!name) { showToast('Enter a name', 'err'); return; }
        if (await run({ action: 'add_member', name }, 'Packer added', 'packer')) newPacker = '';
    }

    const setMember = (m, active) =>
        run({ action: 'set_member_active', id: m.id, active }, active ? 'Back in the list' : 'Removed from the list', 'm' + m.id);

    async function addUser() {
        const ok = await run({
            action: 'add_user',
            username: uName, pin: uPin, role: uRole, display_name: uDisplay
        }, 'User ready', 'user');
        if (ok) { uName = ''; uPin = ''; uDisplay = ''; }
    }

    async function savePin(username) {
        const ok = await run({ action: 'set_pin', username, pin: newPin }, 'PIN changed', 'pin');
        if (ok) { pinFor = ''; newPin = ''; }
    }

    const setUser = (u, active) =>
        run({ action: 'set_user_active', username: u.username, active },
            active ? 'Account enabled' : 'Account disabled', 'u' + u.username);

    const saveQuiet = () =>
        run({ action: 'set_setting', key: 'attention_quiet_days', value: quietDays }, 'Saved', 'quiet');

    let activePackers = $derived(team.filter(t => t.active));
    let inactivePackers = $derived(team.filter(t => !t.active));

    const ROLE_NOTE = {
        cargo: 'Scan and Manifest only',
        packer: 'Boxes only',
        admin: 'Everything'
    };
</script>

<header class="appbar">
    <div class="appbar-row">
        <div>
            <p class="eyebrow">Signed in as {me}</p>
            <h1>Settings</h1>
        </div>
        <button class="appbar-act" onclick={load}>Reload</button>
    </div>
</header>

<div class="body">
    <div class="chips" style="margin-top:0">
        <button class="chip" class:on={tab==='team'} onclick={() => tab='team'}>Packers <b>{activePackers.length}</b></button>
        <button class="chip" class:on={tab==='users'} onclick={() => tab='users'}>Logins <b>{users.filter(u=>u.active).length}</b></button>
        <button class="chip" class:on={tab==='rules'} onclick={() => tab='rules'}>Rules</button>
    </div>

    {#if loading}
        <div class="loading"><div class="spin"></div></div>

    <!-- ══════ packers ══════ -->
    {:else if tab === 'team'}
        <div class="sec"><h2>Packers</h2><span>shown in the box dropdown</span></div>
        <div class="note">
            These are the names a packer picks when opening a box. Removing someone keeps
            their name on every box they already packed.
        </div>

        <div class="field" style="margin-top:12px">
            <label for="np">Name</label>
            <input id="np" bind:value={newPacker} placeholder="e.g. Ravi"
                onkeydown={(e) => e.key === 'Enter' && addPacker()} />
            <button class="field-btn" disabled={busy === 'packer'} onclick={addPacker}>Add</button>
        </div>

        {#if activePackers.length === 0}
            <div class="empty" style="margin-top:14px">
                <div class="empty-ic">▤</div>
                <h3>No packers yet</h3>
                <p>Add a name above and it appears in the box dropdown straight away.</p>
            </div>
        {:else}
            <div class="rows" style="margin-top:14px">
                {#each activePackers as m}
                    <div class="row">
                        <div class="row-mid"><div class="row-trk">{m.name}</div></div>
                        <button class="ab" disabled={busy === 'm' + m.id} onclick={() => setMember(m, false)}>Remove</button>
                    </div>
                {/each}
            </div>
        {/if}

        {#if inactivePackers.length}
            <div class="sec"><h2>Removed</h2><span>{inactivePackers.length}</span></div>
            <div class="rows">
                {#each inactivePackers as m}
                    <div class="row">
                        <div class="row-mid"><div class="row-trk" style="color:var(--ink2)">{m.name}</div></div>
                        <button class="ab" disabled={busy === 'm' + m.id} onclick={() => setMember(m, true)}>Restore</button>
                    </div>
                {/each}
            </div>
        {/if}

    <!-- ══════ logins ══════ -->
    {:else if tab === 'users'}
        <div class="sec"><h2>Add a login</h2></div>
        <div class="note">
            A packer needs a login to open the app, and a name in the Packers tab to appear
            in the box dropdown. They are separate — one is access, the other is attribution.
        </div>

        <div class="form">
            <div class="field">
                <label for="un">User</label>
                <input id="un" bind:value={uName} placeholder="ravi" autocapitalize="none" spellcheck="false" />
            </div>
            <div class="field">
                <label for="ud">Name</label>
                <input id="ud" bind:value={uDisplay} placeholder="Ravi K" />
            </div>
            <div class="field">
                <label for="ur">Role</label>
                <select id="ur" bind:value={uRole}>
                    <option value="cargo">Cargo</option>
                    <option value="packer">Packer</option>
                    <option value="admin">Admin</option>
                </select>
            </div>
            <div class="field">
                <label for="up">PIN</label>
                <input id="up" bind:value={uPin} placeholder="4 digits" inputmode="numeric" maxlength="4" />
            </div>
        </div>
        <p class="rolehint">{ROLE_NOTE[uRole]}</p>
        <button class="act" disabled={busy === 'user'} onclick={addUser}>
            {busy === 'user' ? 'Saving…' : 'Add login'}
        </button>

        <div class="sec"><h2>Existing logins</h2><span>{users.length}</span></div>
        <div class="rows">
            {#each users as u}
                <div class="urow">
                    <div class="utop">
                        <div style="flex:1;min-width:0">
                            <div class="row-trk">{u.username}{u.display_name && u.display_name !== u.username ? ` · ${u.display_name}` : ''}</div>
                            <div class="row-meta">{ROLE_NOTE[u.role]}{u.active ? '' : ' · disabled'}</div>
                        </div>
                        <span class="mark {u.role === 'admin' ? 'bad' : u.role === 'packer' ? 'hold' : 'ok'}">{u.role}</span>
                    </div>
                    {#if pinFor === u.username}
                        <div class="field" style="margin-top:8px">
                            <label for="pin-{u.username}">New PIN</label>
                            <input id="pin-{u.username}" bind:value={newPin} placeholder="4 digits" inputmode="numeric" maxlength="4" />
                            <button class="field-btn" disabled={busy === 'pin'} onclick={() => savePin(u.username)}>Save</button>
                        </div>
                    {/if}
                    <div class="uacts">
                        <button class="ab" onclick={() => { pinFor = pinFor === u.username ? '' : u.username; newPin = ''; }}>
                            {pinFor === u.username ? 'Cancel' : 'Change PIN'}
                        </button>
                        {#if u.username !== 'admin'}
                            <button class="ab" disabled={busy === 'u' + u.username} onclick={() => setUser(u, !u.active)}>
                                {u.active ? 'Disable' : 'Enable'}
                            </button>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>

    <!-- ══════ rules ══════ -->
    {:else}
        <div class="sec"><h2>When to chase a quiet parcel</h2></div>
        <div class="note">
            A parcel with no carrier status is normal transit at first. After this many days
            of silence it moves into Need Attention. Lower it to catch problems sooner,
            raise it if your carriers report late and the list gets noisy.
        </div>
        <div class="field" style="margin-top:12px;max-width:260px">
            <label for="qd">Days</label>
            <input id="qd" bind:value={quietDays} inputmode="numeric" maxlength="2" />
            <button class="field-btn" disabled={busy === 'quiet'} onclick={saveQuiet}>Save</button>
        </div>
    {/if}
</div>

<style>
    .form{display:grid;grid-template-columns:1fr;gap:8px;margin-top:12px}
    @media(min-width:700px){.form{grid-template-columns:1fr 1fr}}
    select{flex:1;border:none;outline:none;padding:11px 12px;font-family:var(--data);font-size:16px;background:#fff;color:var(--ink);min-width:0;appearance:none;-webkit-appearance:none}
    .rolehint{font-family:var(--data);font-size:10px;color:var(--ink2);margin-top:7px}
    .ab{border:1.5px solid var(--rule);background:#fff;font-family:var(--disp);font-size:9.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:5px 9px;color:var(--ink2);flex-shrink:0}
    .ab:hover{border-color:var(--ink);color:var(--ink)}
    .ab:disabled{opacity:.4}
    .urow{padding:11px 12px;border-bottom:1px solid var(--rule);background:#fff}
    .urow:last-child{border-bottom:none}
    .utop{display:flex;align-items:flex-start;gap:10px}
    .uacts{display:flex;gap:5px;margin-top:8px}
</style>
