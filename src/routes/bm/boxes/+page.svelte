<script>
    import { onMount } from 'svelte';
    import { role, who, showToast } from '$lib/stores.js';
    import { goto } from '$app/navigation';
    import * as api from '$lib/api.js';
    import { stamp, dayKey, dayLabel } from '$lib/time.js';

    let r = $state('none');
    let me = $state('');
    let loading = $state(true);
    let busy = $state('');

    let boxes = $state([]);
    let packers = $state([]);
    let days = $state([]);
    let filter = $state('open');

    let making = $state(false);
    let packer = $state('');
    let boxNo = $state('');
    let fullWt = $state('');

    role.subscribe(v => r = v);
    who.subscribe(v => me = v);

    onMount(load);

    async function load(spinner = true) {
        if (spinner) loading = true;
        const out = await api.listBoxes();
        if (spinner) loading = false;
        if (!out.ok) { showToast(out.message || 'Could not load', 'err'); return; }
        boxes = out.data.boxes;
        packers = out.data.packers;
        days = out.data.days ?? [];
        if (!packer && packers.length) packer = packers[0];
        if (!boxNo) boxNo = suggest();
    }

    /** A sensible default so nobody has to invent a naming scheme daily. */
    function suggest() {
        const d = new Date().toLocaleDateString('en-GB', {
            timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric'
        }).replace(/\//g, '.');
        const today = boxes.filter(b => b.box_id.startsWith(`BM ${d}`)).length;
        return `BM ${d} Box ${today + 1}`;
    }

    let shown = $derived(filter === 'all' ? boxes : boxes.filter(b => b.status === filter));

    let byDay = $derived.by(() => {
        const m = new Map();
        for (const b of shown) {
            const k = dayKey(b.created_at, r);
            if (!m.has(k)) m.set(k, []);
            m.get(k).push(b);
        }
        return Array.from(m, ([key, list]) => ({ key, label: dayLabel(key, r), list }))
            .sort((a, b) => b.key.localeCompare(a.key));
    });

    async function create() {
        const w = parseFloat(fullWt);
        if (!packer) { showToast('Pick a packer', 'err'); return; }
        if (!boxNo.trim()) { showToast('Give the box a number', 'err'); return; }
        if (!Number.isFinite(w) || w <= 0) { showToast('Enter the full weight', 'err'); return; }

        busy = 'new';
        const out = await api.createBox({
            box_id: boxNo.trim(), packer_name: packer, filled_weight: w, stream: 'bm'
        });
        busy = '';
        if (!out.ok) {
            showToast(out.status === 409 ? 'That box number already exists'
                    : out.message || 'Could not open the box', 'err');
            return;
        }
        goto(`/bm/boxes/${encodeURIComponent(boxNo.trim())}`);
    }

    async function removeBox(b) {
        const n = Number(b.item_count ?? 0);
        if (!confirm(`Delete ${b.box_id}?\n\n${n ? `Its ${n} item${n === 1 ? '' : 's'} go back to the pool.` : 'It is empty.'}`)) return;
        busy = b.box_id;
        const out = await api.bmDeleteBox(b.box_id);
        busy = '';
        if (!out.ok || !out.data?.ok) {
            showToast(out.data?.reason || 'Could not delete', 'err');
            return;
        }
        showToast('Box deleted, items released', 'ok');
        boxes = boxes.filter(x => x.box_id !== b.box_id);
        load(false);
    }

    const kg = v => (v == null ? '—' : Number(v).toFixed(2) + ' kg');
    const when = ts => stamp(ts, r);
</script>

<header class="appbar">
    <div class="appbar-row">
        <div>
            <p class="eyebrow">Bombino · {boxes.filter(b => b.status === 'open').length} open</p>
            <h1>BM boxes</h1>
        </div>
        <button class="appbar-act bm" onclick={() => { making = !making; boxNo = suggest(); }}>
            {making ? 'Cancel' : '+ New box'}
        </button>
    </div>
</header>

<div class="body">
    {#if making}
        <div class="lbl" style="margin-bottom:16px;max-width:520px">
            <div class="lbl-top"><span class="lbl-carrier">Open a BM box</span></div>
            <div style="padding:14px">
                <div class="field" style="margin-bottom:9px">
                    <label for="pk">Packer</label>
                    <select id="pk" bind:value={packer}>
                        {#each packers as p}<option value={p}>{p}</option>{/each}
                    </select>
                </div>
                <div class="field" style="margin-bottom:9px">
                    <label for="bn">Box no.</label>
                    <input id="bn" bind:value={boxNo} />
                </div>
                <div class="field">
                    <label for="fw">Full wt</label>
                    <input id="fw" bind:value={fullWt} type="number" step="0.01"
                        inputmode="decimal" placeholder="kg"
                        onwheel={(e) => e.currentTarget.blur()} />
                </div>
                <button class="act bm" disabled={busy === 'new'} onclick={create}>
                    {busy === 'new' ? 'Opening…' : 'Open box'}
                </button>
                <div class="note">
                    Full weight is the empty carton plus whatever is already in it. The
                    empty weight is asked when you close it, and net is worked out.
                </div>
            </div>
        </div>
    {/if}

    <div class="chips" style="margin-top:0">
        <button class="chip" class:on={filter==='open'} onclick={() => filter='open'}>
            Open <b>{boxes.filter(b => b.status==='open').length}</b></button>
        <button class="chip" class:on={filter==='closed'} onclick={() => filter='closed'}>
            Closed <b>{boxes.filter(b => b.status==='closed').length}</b></button>
        <button class="chip" class:on={filter==='all'} onclick={() => filter='all'}>
            All <b>{boxes.length}</b></button>
    </div>

    {#if loading}
        <div class="loading"><div class="spin"></div></div>
    {:else if shown.length === 0}
        <div class="empty">
            <div class="empty-ic">▤</div>
            <h3>No boxes here</h3>
            <p>{filter === 'open' ? 'Open a box to start packing Bombino stock.' : 'Closed boxes appear here.'}</p>
        </div>
    {:else}
        {#each byDay as g}
            <div class="daygrp">
                <div class="dayhead">
                    <h3>{g.label}</h3>
                    <span class="dayn">{g.list.length} box{g.list.length === 1 ? '' : 'es'}</span>
                </div>
                {#each g.list as b}
                    <div class="boxrow">
                        <button class="boxmain" onclick={() => goto(`/bm/boxes/${encodeURIComponent(b.box_id)}`)}>
                            <div class="row-mid">
                                <div class="row-trk">{b.box_id}</div>
                                <div class="row-meta">
                                    {b.packer_name || '—'} · {b.item_count} item{b.item_count === 1 ? '' : 's'}
                                    · full {kg(b.filled_weight)}{b.status === 'closed' ? ` · net ${kg(b.net_weight)}` : ''}
                                </div>
                                <div class="row-meta">opened {when(b.created_at)}</div>
                            </div>
                            <span class="mark {b.status === 'open' ? 'hold' : 'ok'}">
                                {b.status === 'open' ? 'Packing' : 'Closed'}
                            </span>
                        </button>
                        {#if b.status === 'open'}
                            <button class="del" disabled={busy === b.box_id} onclick={() => removeBox(b)}>
                                {busy === b.box_id ? '…' : 'Delete'}
                            </button>
                        {/if}
                    </div>
                {/each}
            </div>
        {/each}
    {/if}
</div>

<style>
    .appbar-act.bm{border-color:#2563A8;background:#2563A8;color:#fff}
    .act.bm{background:#2563A8}
    select{flex:1;border:none;outline:none;padding:11px 12px;font-family:var(--data);
        font-size:16px;background:#fff;color:var(--ink);min-width:0;appearance:none;-webkit-appearance:none}
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
</style>
