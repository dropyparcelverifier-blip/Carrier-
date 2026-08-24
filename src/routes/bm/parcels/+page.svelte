<script>
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { role, showToast } from '$lib/stores.js';
    import * as api from '$lib/api.js';
    import { labelFor } from '$lib/time.js';
    import OrderIds from '$lib/OrderIds.svelte';

    let r = $state('none');
    let loading = $state(true);
    let busy = $state(false);

    let days = $state([]);
    let deliveryDays = $state([]);
    let openBy = $state('ordered');
    let openDay = $state('');
    let month = $state('');          // YYYY-MM currently shown
    let rows = $state([]);
    let total = $state(0);
    let more = $state(false);
    let q = $state('');
    let filter = $state('');

    /** Selected tracking numbers. Replaced rather than mutated, so it reacts. */
    let picked = $state(new Set());
    let note = $state('sent before the system');

    role.subscribe(v => r = v);

    onMount(() => {
        const d = $page.url.searchParams.get('day');
        if (d) openDay = d;
        load();
    });

    let inflight = false;

    async function load() {
        if (inflight) return;
        inflight = true;
        loading = true;
        const [dd, mm] = await Promise.all([
            api.bmDays(),
            api.bmManifest({ day: openDay, by: openBy, state: filter, q: q.trim(), size: 50 })
        ]);
        loading = false;
        inflight = false;
        if (dd.ok) {
            days = dd.data.days;
            deliveryDays = dd.data.deliveryDays ?? [];
            // Land on the newest month that actually has parcels, rather than
            // whatever month it happens to be today
            if (!month && days.length) month = String(days[0].day).slice(0, 7);
        }
        if (!mm.ok) { showToast(mm.message || 'Could not load', 'err'); return; }
        rows = mm.data.rows; total = mm.data.total; more = mm.data.more;
        picked = new Set();
    }

    async function loadMore() {
        const out = await api.bmManifest({
            day: openDay, by: openBy, state: filter, q: q.trim(), from: rows.length, size: 50
        });
        if (!out.ok) return;
        rows = [...rows, ...out.data.rows];
        more = out.data.more;
    }

    let timer;
    function typed() { clearTimeout(timer); timer = setTimeout(load, 280); }

    function pickDay(d, by = 'ordered') {
        if (openDay === d && openBy === by) { openDay = ''; load(); return; }
        openDay = d; openBy = by; load();
    }

    /** Back to the calendar without losing the month you were looking at. */
    function backToCalendar() {
        openDay = '';
        openBy = 'ordered';
        q = '';
        load();
    }

    /* ── the month grid ──
       A flat strip of day chips only showed the newest sixty, so May quietly
       fell off the end. A month at a time is bounded however much history
       arrives. */
    let months = $derived([...new Set(
        [...days, ...deliveryDays].map(d => String(d.day).slice(0, 7))
    )].sort());

    function buildGrid(rows) {
        if (!month) return [];
        const [y, m] = month.split('-').map(Number);
        const first = new Date(Date.UTC(y, m - 1, 1));
        const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
        const lead = (first.getUTCDay() + 6) % 7;

        const byDay = new Map(rows.map(d => [String(d.day).slice(0, 10), d]));
        const cells = [];
        for (let i = 0; i < lead; i++) cells.push({ pad: true });

        for (let n = 1; n <= total; n++) {
            const key = `${month}-${String(n).padStart(2, '0')}`;
            const d = byDay.get(key);
            const parcels = Number(d?.parcels ?? 0);
            const sent = Number(d?.sent_before ?? 0);

            let tone = 'none';
            if (parcels > 0) tone = sent === parcels ? 'done' : sent > 0 ? 'part' : 'open';
            cells.push({ key, n, parcels, sent, tone });
        }
        return cells;
    }

    let gridOrdered = $derived(buildGrid(days));
    let gridDelivered = $derived(buildGrid(deliveryDays));

    function shiftMonth(by) {
        if (!month) return;
        const [y, m] = month.split('-').map(Number);
        const d = new Date(Date.UTC(y, m - 1 + by, 1));
        month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }

    let monthLabel = $derived.by(() => {
        if (!month) return '';
        const [y, m] = month.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, 1))
            .toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' });
    });

    let monthTotals = $derived(gridOrdered.filter(c => !c.pad).reduce((t, c) => ({
        parcels: t.parcels + c.parcels,
        sent: t.sent + c.sent
    }), { parcels: 0, sent: 0 }));
    function pickFilter(f) { filter = filter === f ? '' : f; load(); }

    /* ── selection ── */
    function toggle(t) {
        const n = new Set(picked);
        n.has(t) ? n.delete(t) : n.add(t);
        picked = n;
    }
    function toggleAll() {
        const sel = rows.filter(x => x.state !== 'sent_before').map(x => x.tracking_number);
        const all = sel.length > 0 && sel.every(t => picked.has(t));
        picked = all ? new Set() : new Set(sel);
    }
    let list = $derived([...picked]);
    let selectable = $derived(rows.filter(x => x.state !== 'sent_before'));
    let allPicked = $derived(selectable.length > 0 && selectable.every(x => picked.has(x.tracking_number)));

    /* ── mark history as already handled ── */
    async function markSent() {
        if (!list.length) return;
        if (!confirm(`Mark ${list.length} parcel${list.length === 1 ? '' : 's'} as already sent?\n\nTheir items leave the box builder but stay on record here.`)) return;
        busy = true;
        const out = await api.bmMarkSent(list, note);
        busy = false;
        if (!out.ok) { showToast(out.message || 'Could not mark', 'err'); return; }
        showToast(`${out.data.lines} line${out.data.lines === 1 ? '' : 's'} · ${out.data.units} units marked`, 'ok');
        load();
    }

    async function undoSent(t) {
        busy = true;
        const out = await api.bmUnmarkSent([t]);
        busy = false;
        if (!out.ok) { showToast('Could not undo', 'err'); return; }
        showToast('Back in the pool', 'ok');
        load();
    }

    const STATE = {
        waiting:     { c: 'bad',  l: 'Waiting' },
        part_boxed:  { c: 'hold', l: 'Part boxed' },
        boxed:       { c: 'ok',   l: 'Boxed' },
        sent_before: { c: '',     l: 'Sent before' }
    };
</script>

<header class="appbar">
    <div class="appbar-row">
        <div>
            <p class="eyebrow">Bombino · {labelFor(r)}</p>
            <h1>BM manifest</h1>
        </div>
        <button class="appbar-act" onclick={load}>Reload</button>
    </div>
</header>

<div class="body">
    <div class="note">
        Everything Bombino has ordered. Anything handled by hand before this system
        existed should be marked <b>already sent</b>, so it stays out of the box builder —
        otherwise a pad ordered in May sits in the search next to one ordered last week.
    </div>

    <div class="field" style="margin:12px 0">
        <label for="q">Find</label>
        <input id="q" bind:value={q} oninput={typed} placeholder="Tracking number or PO"
            autocomplete="off" spellcheck="false" />
    </div>

    <div class="chips">
        {#each [['waiting','Waiting'],['part_boxed','Part boxed'],['boxed','Boxed'],['sent_before','Sent before']] as [k,l]}
            <button class="chip" class:on={filter === k} onclick={() => pickFilter(k)}>{l}</button>
        {/each}
        {#if openDay}
            <button class="chip on" onclick={() => pickDay(openDay)}>{openDay} ×</button>
        {/if}
    </div>

    {#if !openDay && days.length}
        <div class="calhead">
            <button class="navb" disabled={months.length === 0 || month <= months[0]}
                onclick={() => shiftMonth(-1)}>‹</button>
            <h2>{monthLabel}</h2>
            <button class="navb" disabled={months.length === 0 || month >= months[months.length - 1]}
                onclick={() => shiftMonth(1)}>›</button>
            <span class="sp"></span>
            <span class="mtot">{monthTotals.sent} of {monthTotals.parcels} parcels marked sent</span>
        </div>

        <div class="cals">
            <div>
                <div class="sec" style="margin-top:0">
                    <h2>Ordered</h2>
                    <span>the day the order was placed</span>
                </div>
                <div class="cal">
                    {#each ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as d}
                        <div class="dow">{d}</div>
                    {/each}
                    {#each gridOrdered as c}
                        {#if c.pad}
                            <div class="day pad"></div>
                        {:else}
                            <button class="day {c.tone}"
                                class:sel={openDay === c.key && openBy === 'ordered'}
                                disabled={c.tone === 'none'}
                                onclick={() => pickDay(c.key, 'ordered')}>
                                <span class="num">{c.n}</span>
                                {#if c.parcels > 0}
                                    <span class="cnt">{c.parcels}</span>
                                    <span class="bar"><i style="width:{Math.round(c.sent / c.parcels * 100)}%"></i></span>
                                {/if}
                            </button>
                        {/if}
                    {/each}
                </div>
            </div>
            <div>
                <div class="sec" style="margin-top:0">
                    <h2>Delivered</h2>
                    <span>the day it arrived</span>
                </div>
                <div class="cal">
                    {#each ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as d}
                        <div class="dow">{d}</div>
                    {/each}
                    {#each gridDelivered as c}
                        {#if c.pad}
                            <div class="day pad"></div>
                        {:else}
                            <button class="day {c.tone}"
                                class:sel={openDay === c.key && openBy === 'delivered'}
                                disabled={c.tone === 'none'}
                                onclick={() => pickDay(c.key, 'delivered')}>
                                <span class="num">{c.n}</span>
                                {#if c.parcels > 0}
                                    <span class="cnt">{c.parcels}</span>
                                    <span class="bar"><i style="width:{Math.round(c.sent / c.parcels * 100)}%"></i></span>
                                {/if}
                            </button>
                        {/if}
                    {/each}
                </div>
            </div>
        </div>

    {/if}

    {#if picked.size > 0}
        <div class="selbar">
            <span class="n">{picked.size} selected</span>
            <input class="ninput" bind:value={note} placeholder="Note" />
            <button class="sb v" disabled={busy} onclick={markSent}>Mark already sent</button>
            <button class="sb" onclick={() => picked = new Set()}>Clear</button>
        </div>
    {/if}

    {#if loading}
        <div class="loading"><div class="spin"></div></div>
    {:else if rows.length === 0}
        <div class="empty">
            <div class="empty-ic">▤</div>
            <h3>Nothing here</h3>
            <p>{openDay ? 'No BM parcels ordered that day.' : 'Upload a shipment report to fill this.'}</p>
        </div>
    {:else}
        <div class="sec">
            {#if openDay}
                <button class="backb" onclick={backToCalendar}>‹ Calendar</button>
            {/if}
            <h2>{openDay || 'All dates'}</h2>
            <span>{rows.length} of {total}</span>
        </div>
        <div class="tblwrap">
            <table class="tbl">
                <thead><tr>
                    <th style="width:1%">
                        <button class="cbx" class:on={allPicked} onclick={toggleAll}>{allPicked ? '✓' : ''}</button>
                    </th>
                    <th style="width:86px">Ordered</th><th style="width:100px">PO</th>
                    <th style="width:150px">Tracking</th>
                    <th class="num" style="width:52px">Lines</th>
                    <th class="num" style="width:64px">Units</th>
                    <th class="num" style="width:64px">Boxed</th>
                    <th style="width:104px">State</th>
                    <th style="width:1%"></th>
                </tr></thead>
                <tbody>
                    {#each rows as p}
                        {@const st = STATE[p.state] ?? { c: '', l: p.state }}
                        <tr class:sel={picked.has(p.tracking_number)} class:muted={p.state === 'sent_before'}>
                            <td>
                                {#if p.state !== 'sent_before'}
                                    <button class="cbx" class:on={picked.has(p.tracking_number)}
                                        onclick={() => toggle(p.tracking_number)}>
                                        {picked.has(p.tracking_number) ? '✓' : ''}
                                    </button>
                                {/if}
                            </td>
                            <td class="mono">{p.order_date || '—'}</td>
                            <td class="mono">{p.po_number || '—'}</td>
                            <td class="mono">
                                {p.tracking_number}
                                <OrderIds ids={p.order_ids} compact />
                            </td>
                            <td class="num mono">{p.lines}</td>
                            <td class="num mono">{p.units}</td>
                            <td class="num mono">{p.units_boxed}</td>
                            <td><span class="mark {st.c}">{st.l}</span></td>
                            <td>
                                {#if p.state === 'sent_before'}
                                    <button class="mini" disabled={busy}
                                        onclick={() => undoSent(p.tracking_number)}>Undo</button>
                                {/if}
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
        {#if more}
            <button class="act ghost" style="margin-top:10px" onclick={loadMore}>
                Show more — {total - rows.length} left
            </button>
        {/if}
    {/if}
</div>

<style>
    .calhead{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap}
    .calhead h2{font-family:var(--disp);font-size:16px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
    .sp{flex:1}
    .mtot{font-family:var(--data);font-size:10.5px;color:var(--ink2)}
    .navb{border:1.5px solid var(--ink);background:#fff;font-family:var(--disp);font-size:12px;
        font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:5px 12px;color:var(--ink)}
    .navb:disabled{opacity:.3}
    .backb{border:1.5px solid var(--ink);background:#fff;font-family:var(--disp);font-size:10px;
        font-weight:700;letter-spacing:.11em;text-transform:uppercase;padding:5px 10px;
        color:var(--ink);margin-right:10px}
    .backb:hover{background:var(--ink);color:var(--paper)}

    /* Side by side where the width exists, stacked when it does not — the
       same shape as the Abhi manifest. */
    .cals{display:grid;grid-template-columns:1fr;gap:26px;max-width:1180px}
    @media (min-width:1120px){ .cals{grid-template-columns:1fr 1fr;gap:30px} }
    .cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
    .dow{font-family:var(--data);font-size:9px;letter-spacing:.12em;text-transform:uppercase;
        color:var(--ink3);text-align:center;padding-bottom:2px}
    /* A square cell becomes enormous on a wide screen — a fixed height keeps
       the month readable at any width. */
    .day{height:62px;border:1.5px solid var(--rule);background:#fff;padding:5px 6px;
        display:flex;flex-direction:column;align-items:flex-start;text-align:left}
    .day.pad{border:none;background:none}
    .day .num{font-family:var(--data);font-size:12px;font-weight:600}
    .day .cnt{font-family:var(--data);font-size:10px;color:var(--ink2);margin-top:auto}
    .day .bar{height:4px;background:var(--paper3);margin-top:4px;width:100%}
    .day .bar i{display:block;height:100%;background:#2563A8}
    .day.done{border-color:var(--verify);background:#F2FBF6}
    .day.done .bar i{background:var(--verify)}
    .day.part{border-color:#2563A8;background:#EEF4FB}
    .day.open{border-color:var(--hold);background:#FDF8EC}
    .day.open .bar i{background:var(--hold)}
    .day.none{background:var(--paper2);border-color:var(--rule);opacity:.45;cursor:default}

    .legend{display:flex;gap:14px;margin:10px 0 4px;font-family:var(--data);font-size:9.5px;
        color:var(--ink2);flex-wrap:wrap}
    .legend span{display:flex;align-items:center;gap:5px}
    .sw{width:11px;height:11px;border:1.5px solid;display:inline-block}
    .sw.done{border-color:var(--verify);background:#F2FBF6}
    .sw.part{border-color:#2563A8;background:#EEF4FB}
    .sw.open{border-color:var(--hold);background:#FDF8EC}
    .sw.none{border-color:var(--rule);background:var(--paper2)}

    @media (max-width:640px){
        .cal{gap:3px}
        .day{height:54px;padding:4px}
        .day .num{font-size:11px}
        .day .cnt{font-size:9px}
    }

    .selbar{position:sticky;top:0;z-index:20;background:#2563A8;color:#fff;display:flex;
        align-items:center;gap:8px;padding:9px 12px;margin:10px 0;flex-wrap:wrap}
    .selbar .n{font-family:var(--data);font-size:12px;font-weight:600}
    .ninput{flex:1;min-width:160px;border:1.5px solid rgba(255,255,255,.4);background:rgba(255,255,255,.1);
        color:#fff;padding:6px 9px;font-family:var(--data);font-size:12px;outline:none}
    .ninput::placeholder{color:rgba(255,255,255,.6)}
    .sb{border:1.5px solid rgba(255,255,255,.5);background:transparent;color:#fff;
        font-family:var(--disp);font-size:10px;font-weight:700;letter-spacing:.1em;
        text-transform:uppercase;padding:6px 11px}
    .sb.v{background:#fff;color:#2563A8;border-color:#fff}
    .sb:disabled{opacity:.5}

    .cbx{width:16px;height:16px;border:1.5px solid var(--ink);background:#fff;display:grid;
        place-items:center;font-size:10px;line-height:1;color:#fff;padding:0}
    .cbx.on{background:#2563A8;border-color:#2563A8}

    .tblwrap{overflow-x:auto}
    .tbl{width:100%;border-collapse:collapse;background:#fff;border:1.5px solid var(--ink);min-width:760px}
    .tbl th{background:var(--ink);color:var(--paper);font-family:var(--disp);font-size:9.5px;
        font-weight:600;letter-spacing:.12em;text-transform:uppercase;text-align:left;padding:8px 10px;white-space:nowrap}
    .tbl td{padding:6px 10px;border-bottom:1px solid var(--rule);font-size:12px}
    .tbl tbody tr:hover{background:var(--paper2)}
    .tbl tr.sel td{background:#EEF4FB}
    .tbl tr.muted td{opacity:.55}
    .tbl .num{text-align:right}
    .tbl .mono{font-family:var(--data);font-size:11px}
    .mark{font-family:var(--disp);font-size:9px;font-weight:700;letter-spacing:.1em;
        text-transform:uppercase;padding:2px 6px;border:1.5px solid var(--ink3);color:var(--ink2);
        display:inline-block;white-space:nowrap}
    .mark.ok{color:var(--verify);border-color:var(--verify)}
    .mark.hold{color:var(--hold);border-color:var(--hold)}
    .mark.bad{color:var(--alert);border-color:var(--alert)}
</style>
