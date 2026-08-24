<script>
    /**
     * What is waiting at the warehouse, and for how long.
     *
     * Shared by the cargo Overview and the admin one so the two can never
     * disagree about what "held" means.
     */
    import { onMount } from 'svelte';
    import { showToast } from '$lib/stores.js';
    import * as api from '$lib/api.js';
    import OrderIds from '$lib/OrderIds.svelte';
    import { role } from '$lib/stores.js';

    let { title = 'Waiting to be scanned' } = $props();

    let loading = $state(true);
    let cards = $state({ open: 0, atWarehouse: 0, boxed: 0, held: 0 });
    let buckets = $state({ all: 0, over3: 0, over7: 0, today: 0 });
    let rows = $state([]);

    let q = $state('');
    let op = $state('over');
    let days = $state('');
    let sort = $state('hold');
    let dir = $state('desc');
    let chip = $state('all');

    /** How many rows are on screen. Nine hundred at once helps nobody, and the
     *  work is always at the top of the list. */
    let shown = $state(60);

    let busy = false;

    // Order links are admin-only, so for cargo that column would be an empty
    // strip under a heading — worse than not being there.
    let r = $state('none');
    role.subscribe(v => r = v);
    let showOrders = $derived(r === 'admin');

    onMount(load);

    async function load() {
        if (busy) return;
        busy = true;
        loading = true;
        const out = await api.overview({ q: q.trim(), op, days, sort, dir });
        loading = false;
        busy = false;
        if (!out.ok) { showToast(out.message || 'Could not load', 'err'); return; }
        cards = out.data.cards;
        buckets = out.data.buckets;
        rows = out.data.rows;
        shown = 60;
    }

    let timer;
    function typed() { clearTimeout(timer); timer = setTimeout(load, 300); }

    function pickChip(k) {
        chip = k;
        if (k === 'all') { op = 'over'; days = ''; }
        else if (k === 'over3') { op = 'over'; days = '3'; }
        else if (k === 'over7') { op = 'over'; days = '7'; }
        else if (k === 'today') { op = 'exactly'; days = '0'; }
        load();
    }

    function clear() {
        q = ''; op = 'over'; days = ''; chip = 'all';
        load();
    }

    function sortBy(col) {
        if (sort === col) dir = dir === 'desc' ? 'asc' : 'desc';
        else { sort = col; dir = 'desc'; }
        load();
    }

    /** Exports what is on screen, filter and all — not a different list. */
    function exportList() {
        api.downloadHold({ q: q.trim(), op, days });
    }

    const fmt = n => Number(n ?? 0).toLocaleString();
    const short = d => {
        if (!d) return '—';
        const [y, m, dd] = String(d).slice(0, 10).split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, dd))
            .toLocaleDateString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short' });
    };
</script>

<!-- ══ the four counts ══ -->
<div class="cards">
    <div class="card">
        <div class="k">Total orders</div>
        <div class="v">{fmt(cards.open)}</div>
        <div class="d">open — closed once boxed</div>
    </div>
    <div class="card">
        <div class="k">Delivered to Abhi</div>
        <div class="v v-hold">{fmt(cards.atWarehouse)}</div>
        <div class="d">arrived, not yet scanned in</div>
    </div>
    <div class="card">
        <div class="k">Delivered to Dropy</div>
        <div class="v v-ok">{fmt(cards.boxed)}</div>
        <div class="d">packed into a box</div>
    </div>
    <div class="card" class:alarm={cards.held > 0}>
        <div class="k">Held over 7 days</div>
        <div class="v v-bad">{fmt(cards.held)}</div>
        <div class="d">sitting at Abhi too long</div>
    </div>
</div>

<!-- ══ search and filters ══ -->
<div class="tools">
    <div class="field">
        <label for="hq">Find</label>
        <input id="hq" bind:value={q} oninput={typed}
            placeholder="Tracking number or PO"
            autocomplete="off" autocapitalize="characters" spellcheck="false" />
    </div>
    <div class="holdbox">
        <label for="hop">Hold days</label>
        <select id="hop" bind:value={op} onchange={load}>
            <option value="over">is over</option>
            <option value="exactly">is exactly</option>
            <option value="under">is under</option>
        </select>
        <input bind:value={days} oninput={typed} type="number" inputmode="numeric"
            placeholder="—" onwheel={(e) => e.currentTarget.blur()} />
    </div>
    <button class="btn ghost" onclick={clear}>Clear</button>
    <button class="btn" onclick={exportList}>↓ Export</button>
</div>

<div class="chips">
    <button class="chip" class:on={chip === 'all'} onclick={() => pickChip('all')}>
        All <b>{fmt(buckets.all)}</b></button>
    <button class="chip" class:on={chip === 'over3'} onclick={() => pickChip('over3')}>
        Over 3 days <b>{fmt(buckets.over3)}</b></button>
    <button class="chip" class:on={chip === 'over7'} onclick={() => pickChip('over7')}>
        Over 7 days <b>{fmt(buckets.over7)}</b></button>
    <button class="chip" class:on={chip === 'today'} onclick={() => pickChip('today')}>
        Today <b>{fmt(buckets.today)}</b></button>
</div>

<!-- ══ the list ══ -->
<div class="sec">
    <h2>{title}</h2>
    <span>{fmt(rows.length)}{rows.length !== buckets.all ? ` of ${fmt(buckets.all)}` : ''} · longest held first</span>
</div>

{#if loading}
    <div class="loading"><div class="spin"></div></div>
{:else if rows.length === 0}
    <div class="empty">
        <div class="empty-ic">✓</div>
        <h3>Nothing waiting</h3>
        <p>Every parcel that has arrived has been scanned in.</p>
    </div>
{:else}
    <div class="grid" class:noorders={!showOrders}>
        <div class="ghead">
            <button onclick={() => sortBy('delivered')}>Delivered{#if sort==='delivered'}<i>{dir==='desc'?'▾':'▴'}</i>{/if}</button>
            <button onclick={() => sortBy('tracking')}>Tracking{#if sort==='tracking'}<i>{dir==='desc'?'▾':'▴'}</i>{/if}</button>
            <button onclick={() => sortBy('po')}>PO{#if sort==='po'}<i>{dir==='desc'?'▾':'▴'}</i>{/if}</button>
            {#if showOrders}<span>Order</span>{/if}
            <button class="r" onclick={() => sortBy('hold')}>Hold days{#if sort==='hold'}<i>{dir==='desc'?'▾':'▴'}</i>{/if}</button>
        </div>

        {#each rows.slice(0, shown) as p}
            <div class="grow" class:late={p.hold > 3}>
                <span class="c-date">{short(p.delivery_on)}</span>
                <span class="c-trk">{p.tracking_number}</span>
                <span class="c-po">{p.po_number || '—'}</span>
                {#if showOrders}
                    <span class="c-oid"><OrderIds ids={p.order_ids} compact /></span>
                {/if}
                <span class="c-hold">
                    <b>{p.hold}</b><i>days</i>
                </span>
            </div>
        {/each}
    </div>

    {#if rows.length > shown}
        <button class="act ghost" style="margin-top:10px" onclick={() => shown += 60}>
            Show more — {fmt(rows.length - shown)} left
        </button>
    {/if}
{/if}

<style>
    .cards{display:grid;grid-template-columns:repeat(4,1fr);border:1.5px solid var(--ink);
        background:var(--ink);gap:1.5px}
    .card{background:#fff;padding:13px 15px}
    .card .k{font-family:var(--data);font-size:8.5px;letter-spacing:.15em;text-transform:uppercase;color:var(--ink2)}
    .card .v{font-family:var(--data);font-size:30px;font-weight:600;line-height:1;margin-top:5px}
    .card .d{font-family:var(--data);font-size:9px;color:var(--ink3);margin-top:5px;line-height:1.6}
    .card.alarm{background:#FDF2F1}
    .card.alarm .k{color:var(--alert)}
    .v-ok{color:var(--verify)}.v-hold{color:var(--hold)}.v-bad{color:var(--alert)}

    .tools{display:flex;gap:8px;margin:16px 0 12px;flex-wrap:wrap;align-items:stretch}
    .field{border:1.5px solid var(--ink);background:#fff;display:flex;flex:1;min-width:210px}
    .field label{font-family:var(--data);font-size:9px;letter-spacing:.14em;text-transform:uppercase;
        color:var(--ink2);padding:0 11px;border-right:1.5px solid var(--rule);display:flex;
        align-items:center;background:var(--paper2)}
    .field input{flex:1;border:none;outline:none;padding:10px 12px;font-family:var(--data);
        font-size:15px;min-width:0;background:#fff}
    .holdbox{border:1.5px solid var(--ink);background:#fff;display:flex;align-items:stretch}
    .holdbox label{font-family:var(--data);font-size:9px;letter-spacing:.14em;text-transform:uppercase;
        color:var(--ink2);padding:0 10px;border-right:1.5px solid var(--rule);display:flex;
        align-items:center;background:var(--paper2);white-space:nowrap}
    .holdbox select{border:none;outline:none;background:#fff;font-family:var(--data);
        font-size:13px;padding:0 6px;color:var(--ink)}
    .holdbox input{width:58px;border:none;border-left:1px solid var(--rule);outline:none;
        padding:10px 6px;font-family:var(--data);font-size:15px;text-align:center;background:#fff}
    .btn{border:1.5px solid var(--ink);background:var(--ink);color:var(--paper);font-family:var(--disp);
        font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
        padding:0 16px;white-space:nowrap}
    .btn.ghost{background:#fff;color:var(--ink)}

    .chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px}
    .chip{border:1.5px solid var(--ink);background:#fff;padding:6px 11px;font-family:var(--disp);
        font-size:10px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;
        display:flex;align-items:center;gap:6px;color:var(--ink)}
    .chip.on{background:var(--ink);color:var(--paper)}
    .chip.on b{color:var(--signal)}

    .sec{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:18px 0 8px}
    .sec h2{font-family:var(--disp);font-size:12px;font-weight:700;letter-spacing:.15em;text-transform:uppercase}
    .sec span{font-family:var(--data);font-size:10px;color:var(--ink3);white-space:nowrap}

    /* One markup for both shapes: columns on a desktop, a card per parcel on a
       phone. A five-column table on a 390px screen is unreadable. */
    .grid{border:1.5px solid var(--ink);background:#fff;
        --cols:88px 168px 108px 1fr 92px}
    .grid.noorders{--cols:110px 1fr 160px 110px}
    .ghead{display:grid;grid-template-columns:var(--cols);gap:10px;
        background:var(--ink);padding:8px 12px}
    .ghead button,.ghead span{background:none;border:none;text-align:left;color:var(--paper);
        font-family:var(--disp);font-size:9.5px;font-weight:600;letter-spacing:.12em;
        text-transform:uppercase;padding:0}
    .ghead .r{text-align:right}
    .ghead i{color:var(--signal);font-style:normal;margin-left:4px}

    .grow{display:grid;grid-template-columns:var(--cols);gap:10px;
        align-items:center;padding:9px 12px;border-bottom:1px solid var(--rule)}
    .grow:last-child{border-bottom:none}
    .grow:hover{background:var(--paper2)}
    .c-date{font-family:var(--data);font-size:11px;color:var(--ink2)}
    .c-trk{font-family:var(--data);font-size:12px;font-weight:600;overflow:hidden;
        text-overflow:ellipsis;white-space:nowrap}
    .c-po{font-family:var(--data);font-size:11px;color:var(--ink2)}
    .c-oid{min-width:0;overflow:hidden}
    .c-hold{text-align:right;white-space:nowrap}
    .c-hold b{font-family:var(--data);font-size:15px;font-weight:600;color:var(--ink2)}
    .c-hold i{display:none}
    .grow.late .c-hold b{color:var(--alert)}

    @media (max-width:820px){
        .cards{grid-template-columns:repeat(2,1fr)}
        .card .v{font-size:24px}
        .card .d{display:none}
        .ghead{display:none}
        .grid,.grid.noorders{--cols:1fr auto}
        .grow{gap:4px 12px;padding:11px 12px}
        /* PO and the delivery date shared row 2 and printed on top of each
           other. One line each, in reading order. */
        .c-trk{grid-column:1;grid-row:1;font-size:12.5px}
        .c-po{grid-column:1;grid-row:2;font-size:10.5px}
        .c-date{grid-column:1;grid-row:3;font-size:10px}
        .c-date::before{content:'delivered ';color:var(--ink3)}
        .c-oid{grid-column:1;grid-row:4}
        .c-hold{grid-column:2;grid-row:1 / span 4;align-self:center}
        .c-hold b{font-size:22px;display:block;line-height:1}
        .c-hold i{display:block;font-family:var(--data);font-size:8px;font-style:normal;
            letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);margin-top:2px}
    }
</style>
