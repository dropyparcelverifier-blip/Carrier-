<script>
    import { onMount } from 'svelte';
    import { role, who, showToast } from '$lib/stores.js';
    import * as api from '$lib/api.js';
    import { stamp, dayKey, dayLabel } from '$lib/time.js';
    import { goto } from '$app/navigation';

    let r = $state('none');
    let me = $state('');
    let boxes = $state([]);
    let packers = $state([]);
    let days = $state([]);
    let loading = $state(true);
    let showNew = $state(false);
    let saving = $state(false);
    let filter = $state('open');

    // new box form
    let fPacker = $state('');
    let fNumber = $state('');
    let fWeight = $state('');

    role.subscribe(v => r = v);
    who.subscribe(v => me = v);

    onMount(() => {
        load();
    });

    async function load(spinner = true) {
        if (spinner) loading = true;
        const out = await api.listBoxes();
        if (spinner) loading = false;
        if (!out.ok) { showToast('Could not load boxes', 'err'); return; }
        boxes = out.data.boxes;
        packers = out.data.packers;
        days = out.data.days ?? [];
        if (!fPacker && packers.length) fPacker = packers[0];
    }

    let shown = $derived(
        filter === 'all' ? boxes : boxes.filter(b => b.status === filter)
    );

    /** Boxes bundled by the day they were opened — that is the day the lot
     *  arrived, which is how the team thinks about them. */
    let openedByDay = $derived.by(() => {
        const m = new Map();
        for (const b of boxes) {
            if (filter !== 'all' && b.status !== filter) continue;
            const k = dayKey(b.created_at, r);
            if (!m.has(k)) m.set(k, []);
            m.get(k).push(b);
        }
        return Array.from(m, ([key, list]) => ({
            key, label: dayLabel(key, r), list
        })).sort((a, b) => b.key.localeCompare(a.key));
    });

    let byDay = $derived.by(() => {
        const m = new Map();
        for (const b of boxes) {
            if (b.status !== 'closed' || !b.closed_at) continue;
            const k = dayKey(b.closed_at, r);
            if (!m.has(k)) m.set(k, []);
            m.get(k).push(b);
        }
        return Array.from(m, ([key, list]) => ({
            key,
            label: dayLabel(key, r),
            list,
            parcels: list.reduce((s, b) => s + Number(b.parcel_count ?? 0), 0),
            items: list.reduce((s, b) => s + Number(b.item_count ?? 0), 0),
            net: list.reduce((s, b) => s + Number(b.net_weight ?? 0), 0)
        })).sort((a, b) => b.key.localeCompare(a.key));
    });
    let openCount = $derived(boxes.filter(b => b.status === 'open').length);
    let closedCount = $derived(boxes.filter(b => b.status === 'closed').length);

    async function create() {
        const id = fNumber.trim();
        if (!id) { showToast('Enter a box number', 'err'); return; }
        if (!fPacker) { showToast('Pick a packer', 'err'); return; }
        const w = parseFloat(fWeight);
        if (!Number.isFinite(w) || w <= 0) { showToast('Enter the full weight', 'err'); return; }

        saving = true;
        const out = await api.createBox({ box_id: id, packer_name: fPacker, filled_weight: w });
        saving = false;

        if (!out.ok) {
            showToast(out.status === 409 ? 'That box number already exists'
                    : out.reason === 'offline' ? 'No connection' : 'Could not create the box', 'err');
            return;
        }

        showToast('Box opened', 'ok');
        showNew = false;
        fNumber = ''; fWeight = '';
        goto(`/boxes/${encodeURIComponent(id)}`);
    }

    let removing = $state('');

    /** Deleting an open box releases its parcels rather than stranding them as
     *  boxed with no box to belong to. A closed box is a record; the server
     *  refuses to delete one. */
    async function removeBox(b) {
        if (b.status !== 'open') return;

        const has = Number(b.parcel_count ?? 0);
        const msg = has
            ? `Delete ${b.box_id}?\n\nIts ${has} parcel${has === 1 ? '' : 's'} go back to the pool and can be packed into another box.`
            : `Delete ${b.box_id}?`;
        if (!confirm(msg)) return;

        removing = b.box_id;
        const out = await api.deleteBox(b.box_id);
        removing = '';

        if (!out.ok) {
            showToast(out.status === 409 ? 'A closed box cannot be deleted'
                    : out.reason === 'offline' ? 'No connection — try again'
                    : 'Could not delete', 'err');
            return;
        }

        showToast(has ? `Deleted · ${has} parcel${has === 1 ? '' : 's'} released` : 'Box deleted', 'ok');
        boxes = boxes.filter(x => x.box_id !== b.box_id);
        load(false);
    }

    const when = ts => stamp(ts, r);

    const kg = v => (v == null ? '—' : Number(v).toFixed(2) + ' kg');
</script>

<header class="appbar">
    <div class="appbar-row">
        <div>
            <p class="eyebrow">{openCount} open · {closedCount} closed</p>
            <h1>Boxes</h1>
        </div>
        <button class="appbar-act" onclick={() => showNew = !showNew}>
            {showNew ? 'Cancel' : '+ New box'}
        </button>
    </div>
</header>

<div class="body">
    {#if showNew}
        <div class="lbl" style="margin-bottom:18px">
            <div class="lbl-top"><span class="lbl-carrier">Open a new box</span></div>
            <div style="padding:14px">
                <div class="field" style="margin-bottom:9px">
                    <label for="pk">Packer</label>
                    <select id="pk" bind:value={fPacker}>
                        {#each packers as p}<option value={p}>{p}</option>{/each}
                    </select>
                </div>
                <div class="field" style="margin-bottom:9px">
                    <label for="bn">Box no.</label>
                    <input id="bn" bind:value={fNumber} placeholder="e.g. BOX-045"
                        autocomplete="off" autocapitalize="characters" spellcheck="false" />
                </div>
                <div class="field">
                    <label for="fw">Full wt</label>
                    <input id="fw" bind:value={fWeight} type="number" step="0.01" inputmode="decimal" placeholder="kg" />
                </div>
                <button class="act" onclick={create} disabled={saving}>
                    {saving ? 'Opening…' : 'Open box'}
                </button>
                <div class="note">
                    Full weight is the box as it arrived, before you open it. The empty box weight is asked when you close it.
                </div>
            </div>
        </div>
    {/if}

    <div class="chips" style="margin-top:0">
        <button class="chip" class:on={filter==='open'} onclick={() => filter='open'}>Open <b>{openCount}</b></button>
        <button class="chip" class:on={filter==='closed'} onclick={() => filter='closed'}>Closed <b>{closedCount}</b></button>
        <button class="chip" class:on={filter==='all'} onclick={() => filter='all'}>All <b>{boxes.length}</b></button>
        {#if r === 'admin'}
            <button class="chip" class:on={filter==='files'} onclick={() => filter='files'}>Box files <b>{byDay.length}</b></button>
        {/if}
    </div>

    {#if filter === 'files'}
        <div class="sec"><h2>Box files</h2><span>one file per day</span></div>
        <div class="note">
            Every box closed on a day goes into a single sheet, in the column shape the
            customs paperwork expects. Weight is per unit, so a line of 12 at 681 g
            totals 8,172 g in the summary.
        </div>

        {#if byDay.length === 0}
            <div class="empty" style="margin-top:14px">
                <div class="empty-ic">▤</div>
                <h3>No closed boxes yet</h3>
                <p>A day appears here once its first box is closed.</p>
            </div>
        {:else}
            <div class="rows" style="margin-top:12px">
                {#each byDay as d}
                    <div class="drow">
                        <div class="dmid">
                            <div class="dday">{d.label}</div>
                            <div class="dmeta">
                                {d.list.length} box{d.list.length === 1 ? '' : 'es'} ·
                                {d.parcels} parcel{d.parcels === 1 ? '' : 's'} ·
                                {d.items} item{d.items === 1 ? '' : 's'} ·
                                {d.net.toFixed(2)} kg net
                            </div>
                            <div class="dboxes">{d.list.map(b => b.box_id).join(' · ')}</div>
                        </div>
                        <button class="dl" onclick={() => api.downloadBoxFile({ day: d.key })}>↓ Excel</button>
                    </div>
                {/each}
            </div>
        {/if}
    {:else}
    <div class="sec"><h2>{filter === 'all' ? 'All boxes' : filter === 'open' ? 'Being packed' : 'Closed'}</h2><span>{shown.length}</span></div>

    {#if loading}
        <div class="loading"><div class="spin"></div></div>
    {:else if shown.length === 0}
        <div class="empty">
            <div class="empty-ic">▤</div>
            <h3>No boxes here</h3>
            <p>{filter === 'open' ? 'Open a new box to start packing.' : 'Closed boxes appear here with their logs.'}</p>
        </div>
    {:else}
        {#each openedByDay as g}
            <div class="daygrp">
                <div class="dayhead">
                    <h3>{g.label}</h3>
                    <span class="dayn">{g.list.length} box{g.list.length === 1 ? '' : 'es'}</span>
                </div>
                {#each g.list as b}
                    <div class="boxrow">
                        <button class="boxmain" onclick={() => goto(`/boxes/${encodeURIComponent(b.box_id)}`)}>
                            <div class="row-mid">
                                <div class="row-trk">{b.box_id}</div>
                                <div class="row-meta">
                                    {b.packer_name || '—'} · {b.parcel_count} parcel{b.parcel_count === 1 ? '' : 's'} · {b.item_count} item{b.item_count === 1 ? '' : 's'}
                                </div>
                                <div class="row-meta">
                                    Full {kg(b.filled_weight)}{b.status === 'closed' ? ` · Net ${kg(b.net_weight)}` : ''} · opened {when(b.created_at)}
                                </div>
                            </div>
                            <span class="mark {b.status === 'open' ? 'hold' : 'ok'}">
                                {b.status === 'open' ? 'Packing' : 'Closed'}
                            </span>
                        </button>
                        {#if b.status === 'open'}
                            <button class="del" disabled={removing === b.box_id}
                                onclick={() => removeBox(b)} title="Delete this box">
                                {removing === b.box_id ? '…' : 'Delete'}
                            </button>
                        {/if}
                    </div>
                {/each}
            </div>
        {/each}
    {/if}
    {/if}
</div>

<style>
    .daygrp{border:1.5px solid var(--ink);background:#fff;margin-bottom:14px}
    .dayhead{display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--paper2);
        border-bottom:1.5px solid var(--ink)}
    .dayhead h3{font-family:var(--disp);font-size:12px;font-weight:700;letter-spacing:.13em;
        text-transform:uppercase;flex:1}
    .dayn{font-family:var(--data);font-size:11px;color:var(--ink2)}
    .boxrow{display:flex;align-items:stretch;border-bottom:1px solid var(--rule)}
    .boxrow:last-child{border-bottom:none}
    .boxmain{flex:1;display:flex;align-items:center;gap:11px;padding:11px 12px;background:#fff;
        border:none;text-align:left;min-width:0}
    .boxmain:hover{background:var(--paper2)}
    .del{border:none;border-left:1px solid var(--rule);background:#fff;color:var(--alert);
        font-family:var(--disp);font-size:9.5px;font-weight:700;letter-spacing:.1em;
        text-transform:uppercase;padding:0 14px;white-space:nowrap}
    .del:hover{background:var(--alert);color:#fff}
    .del:disabled{opacity:.4}

    .drow{display:flex;align-items:center;gap:12px;padding:11px 12px;border-bottom:1px solid var(--rule);background:#fff}
    .drow:last-child{border-bottom:none}
    .dmid{flex:1;min-width:0}
    .dday{font-family:var(--disp);font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
    .dmeta{font-family:var(--data);font-size:10.5px;color:var(--ink2);margin-top:3px}
    .dboxes{font-family:var(--data);font-size:9.5px;color:var(--ink3);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dl{border:1.5px solid var(--ink);background:var(--ink);color:var(--paper);font-family:var(--disp);font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:9px 15px;white-space:nowrap;flex-shrink:0}
    .boxrow{width:100%;text-align:left;background:#fff;border:none;border-bottom:1px solid var(--rule)}
    .boxrow:last-child{border-bottom:none}
    .boxrow:active{background:var(--paper2)}
    select{flex:1;border:none;outline:none;padding:11px 12px;font-family:var(--data);font-size:16px;background:#fff;color:var(--ink);min-width:0;appearance:none;-webkit-appearance:none}
</style>
