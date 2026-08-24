<script>
    import { onMount } from 'svelte';
    import { role, showToast } from '$lib/stores.js';
    import { goto } from '$app/navigation';
    import * as api from '$lib/api.js';
    import { stamp, labelFor } from '$lib/time.js';
    import Trk from '$lib/Trk.svelte';
    import OrderIds from '$lib/OrderIds.svelte';

    let myRole = $state('none');
    let loading = $state(true);

    let month = $state('');
    let days = $state([]);
    let deliveryDays = $state([]);
    let openBy = $state('ordered');    // which calendar the open day came from
    let earliest = $state(null);
    let latest = $state(null);

    let openDay = $state('');
    let q = $state('');

    // Each group loads independently and grows as it is scrolled
    let groups = $state({
        received: { rows: [], total: 0, more: false, open: true, busy: false },
        missing:  { rows: [], total: 0, more: false, open: true, busy: false }
    });

    role.subscribe(v => myRole = v);

    onMount(() => {
        loadMonth();
    });

    /** Guards against two loads running at once. Mount and a fast month click
     *  were each firing a request; the second arrived after the first and
     *  redrew the whole month again for nothing. */
    let inflight = null;

    async function loadMonth(m) {
        const want = m ?? month ?? '';
        if (inflight === want) return;
        inflight = want;

        loading = true;
        const out = await api.manifestMonth(m);
        loading = false;
        inflight = null;
        if (!out.ok) { showToast(out.message || 'Could not load', 'err'); return; }
        month = out.data.month;
        days = out.data.days;
        deliveryDays = out.data.deliveryDays ?? [];
        earliest = out.data.earliest;
        latest = out.data.latest;
    }

    function shift(by) {
        const [y, m] = month.split('-').map(Number);
        const d = new Date(Date.UTC(y, m - 1 + by, 1));
        openDay = '';
        loadMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    }

    /** Build a month of cells from a set of day rows. Used for both calendars,
     *  so they cannot drift apart. */
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
            const delivered = Number(d?.delivered ?? 0);
            const scanned = Number(d?.scanned ?? 0);
            const total_ = Number(d?.total ?? 0);

            let tone = 'none';
            if (delivered > 0) tone = scanned === delivered ? 'g' : scanned === 0 ? 'r' : 'a';
            else if (total_ > 0) tone = 'transit';

            cells.push({
                key, n, delivered, scanned, total: total_,
                pct: delivered ? Math.round(scanned / delivered * 100) : 0, tone
            });
        }
        return cells;
    }

    let gridOrdered  = $derived(buildGrid(days));
    let gridDelivered = $derived(buildGrid(deliveryDays));

    /* ── month grid ── */
    let mLabel = $derived.by(() => {
        if (!month) return '';
        const [y, m] = month.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, 1))
            .toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' });
    });

    /** How much of the shown month has a delivery date. Below about half and
     *  the calendar is more gap than data, which is worth saying out loud. */
    let coverage = $derived.by(() => {
        const ordered = days.reduce((n, d) => n + Number(d.total ?? 0), 0);
        const arrived = deliveryDays.reduce((n, d) => n + Number(d.total ?? 0), 0);
        return ordered ? arrived / ordered : 1;
    });

    let monthTotals = $derived(days.reduce((t, d) => ({
        delivered: t.delivered + Number(d.delivered ?? 0),
        scanned: t.scanned + Number(d.scanned ?? 0),
        missing: t.missing + Number(d.missing ?? 0)
    }), { delivered: 0, scanned: 0, missing: 0 }));

    /* ── one day ── */
    async function openCell(c, by = 'ordered') {
        if (c.pad || c.tone === 'none') return;
        if (openDay === c.key && openBy === by) { openDay = ''; return; }
        openDay = c.key;
        openBy = by;
        q = '';
        groups = {
            received: { rows: [], total: 0, more: false, open: true, busy: false },
            missing:  { rows: [], total: 0, more: false, open: true, busy: false }
        };
        await Promise.all([loadGroup('missing', true), loadGroup('received', true)]);
    }

    async function loadGroup(name, reset = false) {
        const g = groups[name];
        if (g.busy) return;
        groups[name] = { ...g, busy: true };

        const from = reset ? 0 : g.rows.length;
        const out = await api.manifestDay(openDay, {
            group: name, by: openBy, from, size: 25, q: q.trim()
        });

        if (!out.ok) {
            groups[name] = { ...groups[name], busy: false };
            showToast(out.message || 'Could not load', 'err');
            return;
        }

        groups[name] = {
            ...groups[name],
            rows: reset ? out.data.rows : [...g.rows, ...out.data.rows],
            total: out.data.total,
            more: out.data.more,
            busy: false
        };
    }

    let timer;
    function typed() {
        clearTimeout(timer);
        timer = setTimeout(() => {
            loadGroup('missing', true);
            loadGroup('received', true);
        }, 280);
    }

    function toggle(name) {
        groups[name] = { ...groups[name], open: !groups[name].open };
    }

    /** Loads the next page when the sentinel scrolls into view. */
    function whenVisible(node, name) {
        const io = new IntersectionObserver(([e]) => {
            if (e.isIntersecting) loadGroup(name);
        }, { rootMargin: '120px' });
        io.observe(node);
        return { destroy() { io.disconnect(); } };
    }

    async function receive(t) {
        const out = await api.receive(t);
        if (!out.ok || (!out.data?.ok && out.data?.reason !== 'already')) {
            showToast(out.reason === 'offline' ? 'Not saved — no connection' : 'Not saved', 'err');
            return;
        }
        showToast('Received', 'ok');
        loadGroup('missing', true);
        loadGroup('received', true);
        loadMonth(month);
    }

    function mark(p) {
        if (p.warehouse_received) return { c: 'ok', l: 'On hand' };
        if (p.attention_state) return { c: 'hold', l: p.attention_state.replace('_', ' ') };
        if (p.delivery_state === 'delivered') return { c: 'bad', l: 'Missing' };
        if (p.delivery_state === 'not_delivered') return { c: 'bad', l: 'Not delivered' };
        return { c: 'hold', l: 'In transit' };
    }

    const dayLabel = k => {
        if (!k) return '';
        const [y, m, d] = k.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, d))
            .toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
    };
</script>

<header class="appbar">
    <div class="appbar-row">
        <div>
            <p class="eyebrow">By order date · {labelFor(myRole)}</p>
            <h1>Manifest</h1>
        </div>
        <div class="dt-tally">
            <div><div class="n n-ok">{monthTotals.scanned}</div><div class="l">Scanned</div></div>
            <div><div class="n n-bad">{monthTotals.missing}</div><div class="l">Missing</div></div>
        </div>
    </div>
</header>

<div class="body">
    <div class="calhead">
        <button class="navb" onclick={() => shift(-1)}>‹</button>
        <h2>{mLabel}</h2>
        <button class="navb" onclick={() => shift(1)}>›</button>
        <span class="sp"></span>
        <span class="mtot">{monthTotals.scanned} of {monthTotals.delivered} scanned</span>
    </div>

    {#if loading}
        <div class="loading"><div class="spin"></div></div>
    {:else}
        <div class="calwrap">
        <div class="cals">
            <div>
            <div class="sec" style="margin-top:0"><h2>Ordered</h2><span>the day the order was placed</span></div>
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
                            onclick={() => openCell(c, 'ordered')}
                            disabled={c.tone === 'none'}>
                            <span class="num">{c.n}</span>
                            {#if c.tone !== 'none'}
                                {#if c.delivered > 0}
                                    <span class="cnt">{c.scanned}/{c.delivered}</span>
                                    <span class="bar"><i style="width:{c.pct}%"></i></span>
                                {:else}
                                    <span class="cnt">{c.total} in transit</span>
                                {/if}
                            {/if}
                        </button>
                    {/if}
                {/each}
            </div>

            </div>
            <div>
            <div class="sec" style="margin-top:0"><h2>Delivered</h2><span>the day it arrived</span></div>
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
                            onclick={() => openCell(c, 'delivered')}
                            disabled={c.tone === 'none'}>
                            <span class="num">{c.n}</span>
                            {#if c.tone !== 'none'}
                                {#if c.delivered > 0}
                                    <span class="cnt">{c.scanned}/{c.delivered}</span>
                                    <span class="bar"><i style="width:{c.pct}%"></i></span>
                                {:else}
                                    <span class="cnt">{c.total} in transit</span>
                                {/if}
                            {/if}
                        </button>
                    {/if}
                {/each}
            </div>

            </div>
        </div>

            {#if deliveryDays.length === 0}
                <div class="note">
                    No delivery dates on file yet. Upload a shipment report covering
                    the period you want — the date was never captured before, so it
                    only fills in for parcels a report has been read since.
                </div>
            {:else if coverage < 0.6}
                <div class="note">
                    Only part of this month has delivery dates. They fill in per parcel
                    as reports are read, so uploading one that covers the whole period
                    completes the calendar.
                </div>
            {/if}

            <div class="legend">
                <span><i class="sw g"></i> all scanned</span>
                <span><i class="sw a"></i> part scanned</span>
                <span><i class="sw r"></i> none scanned</span>
                <span><i class="sw t"></i> still in transit</span>
                <span><i class="sw n"></i> nothing that day</span>
            </div>
        </div>
    {/if}

    <!-- ══ one day ══ -->
    {#if openDay}
        <div class="daypanel">
            <div class="dayhead">
                <div>
                    <p class="eyebrow" style="color:var(--ink2)">{dayLabel(openDay)}</p>
                    <h2>{groups.received.total} of {groups.received.total + groups.missing.total} scanned</h2>
                </div>
                <div class="dayacts">
                    <button class="navb" onclick={() => api.downloadXlsx('day', { day: openDay })}>↓ Excel</button>
                    <button class="navb" onclick={() => openDay = ''}>Close</button>
                </div>
            </div>

            <div class="field" style="margin-bottom:12px">
                <label for="dq">Find</label>
                <input id="dq" bind:value={q} oninput={typed}
                    placeholder="Tracking number or PO — this day only"
                    autocomplete="off" autocapitalize="characters" spellcheck="false" />
            </div>

            {#each [['missing','Missing','bad'],['received','Received by cargo','ok']] as [name, title, tone]}
                {@const g = groups[name]}
                <div class="exp">
                    <button class="exphead" onclick={() => toggle(name)}>
                        <span class="caret" class:up={g.open}>▸</span>
                        <h3>{title}</h3>
                        <span class="mark {tone}">{g.total}</span>
                        {#if g.total > 0}
                            <span class="dl" role="button" tabindex="0"
                                onclick={(e) => { e.stopPropagation(); api.downloadXlsx(`day_${name}`, { day: openDay }); }}
                                onkeydown={(e) => e.key === 'Enter' && api.downloadXlsx(`day_${name}`, { day: openDay })}
                            >↓ Excel</span>
                        {/if}
                    </button>
                    {#if g.open}
                        <div class="explist">
                            {#if g.rows.length === 0 && !g.busy}
                                <p class="none">Nothing here.</p>
                            {:else}
                                {#each g.rows as p}
                                    {@const m = mark(p)}
                                    <div class="drow">
                                        <span class="dtrk"><Trk value={p.tracking_number} /></span>
                                        <span class="dpo">{p.po_number || '—'}</span>
                                        <OrderIds ids={p.order_ids} compact />
                                        <span class="dmeta">{p.carrier || '—'} · {p.item_count} pcs</span>
                                        <span class="mark {m.c}">{m.l}</span>
                                        {#if p.warehouse_received}
                                            <span class="dwhen">{stamp(p.warehouse_received_at, myRole)}</span>
                                        {:else}
                                            <button class="mini" onclick={() => receive(p.tracking_number)}>Receive</button>
                                        {/if}
                                    </div>
                                {/each}
                                {#if g.more}
                                    <div class="lazy" use:whenVisible={name}>
                                        {g.busy ? 'loading…' : `${g.total - g.rows.length} more`}
                                    </div>
                                {:else if g.busy}
                                    <div class="lazy">loading…</div>
                                {/if}
                            {/if}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .calhead{display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap}
    .calhead h2{font-family:var(--disp);font-size:16px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
    .sp{flex:1}
    .mtot{font-family:var(--data);font-size:10.5px;color:var(--ink2)}
    .navb{border:1.5px solid var(--ink);background:#fff;font-family:var(--disp);font-size:11px;
        font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:6px 12px;color:var(--ink)}

    /* Admin is used on a desktop, where a full-width month makes each cell
       enormous and the eye has to travel. Held to a comfortable reading width. */
    .calwrap{max-width:1180px}
    /* Side by side on a desktop, where the width is there to use — stacked
       only when the screen is too narrow to hold both. */
    .cals{display:grid;grid-template-columns:1fr;gap:26px}
    @media (min-width:1120px){ .cals{grid-template-columns:1fr 1fr;gap:30px} }
    .cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
    .dow{font-family:var(--data);font-size:9px;letter-spacing:.12em;text-transform:uppercase;
        color:var(--ink3);text-align:center;padding-bottom:2px}
    .day{height:62px;border:1.5px solid var(--rule);background:#fff;padding:5px 6px;
        display:flex;flex-direction:column;align-items:flex-start;text-align:left}
    .day.pad{border:none;background:none}
    .day .num{font-family:var(--data);font-size:11.5px;font-weight:600}
    .day .cnt{font-family:var(--data);font-size:9px;color:var(--ink2);margin-top:auto}
    .day .bar{height:4px;background:var(--paper3);margin-top:4px;width:100%}
    .day .bar i{display:block;height:100%}
    .day.g{border-color:var(--verify);background:#F2FBF6}
    .day.g .bar i{background:var(--verify)}
    .day.a{border-color:var(--hold);background:#FDF8EC}
    .day.a .bar i{background:var(--hold)}
    .day.r{border-color:var(--alert);background:#FDF2F1}
    .day.r .bar i{background:var(--alert)}
    .day.transit{border-color:var(--ink3);background:#fff}
    .day.none{background:var(--paper2);border-color:var(--rule);opacity:.5;cursor:default}
    .day.sel{outline:3px solid var(--signal);outline-offset:-3px}

    .legend{display:flex;gap:14px;margin-top:10px;font-family:var(--data);font-size:9.5px;
        color:var(--ink2);flex-wrap:wrap}
    .legend span{display:flex;align-items:center;gap:5px}
    .sw{width:11px;height:11px;border:1.5px solid;display:inline-block}
    .sw.g{border-color:var(--verify);background:#F2FBF6}
    .sw.a{border-color:var(--hold);background:#FDF8EC}
    .sw.r{border-color:var(--alert);background:#FDF2F1}
    .sw.t{border-color:var(--ink3);background:#fff}
    .sw.n{border-color:var(--rule);background:var(--paper2)}

    .daypanel{margin-top:20px;border-top:1.5px solid var(--ink);padding-top:16px}
    .dayhead{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:12px}
    .dayhead h2{font-family:var(--disp);font-size:17px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}

    .exp{border:1.5px solid var(--ink);background:#fff;margin-bottom:10px}
    .exphead{width:100%;display:flex;align-items:center;gap:10px;padding:10px 12px;
        background:var(--paper2);border:none;text-align:left}
    .dayacts{display:flex;gap:6px}
    .dl{border:1.5px solid var(--ink);background:#fff;font-family:var(--disp);font-size:9px;
        font-weight:700;letter-spacing:.09em;text-transform:uppercase;padding:4px 8px;
        color:var(--ink);white-space:nowrap}
    .dl:hover{background:var(--ink);color:var(--paper)}
    .exphead h3{font-family:var(--disp);font-size:11px;font-weight:700;letter-spacing:.13em;
        text-transform:uppercase;flex:1}
    .caret{font-size:10px;color:var(--ink3);transition:transform .15s;display:inline-block}
    .caret.up{transform:rotate(90deg)}
    .explist{border-top:1.5px solid var(--ink)}
    .drow{display:flex;align-items:center;gap:10px;padding:7px 12px;border-bottom:1px solid var(--rule)}
    .drow:last-child{border-bottom:none}
    .dtrk{font-family:var(--data);font-size:11.5px;font-weight:600;min-width:150px}
    .dpo{font-family:var(--data);font-size:10px;color:var(--ink2);min-width:90px}
    .dmeta{font-family:var(--data);font-size:10px;color:var(--ink2);flex:1;min-width:0;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dwhen{font-family:var(--data);font-size:10px;color:var(--ink2);white-space:nowrap}
    .lazy{padding:11px;text-align:center;font-family:var(--data);font-size:10px;
        color:var(--ink3);border-top:1px dashed var(--rule)}
    .none{padding:14px 12px;font-family:var(--data);font-size:10.5px;color:var(--ink2)}

    /* phone: the fraction becomes a dot so the numbers stay readable */
    @media (max-width:640px){
        .cal{gap:3px}
        .day{padding:4px}
        .day .num{font-size:11px}
        .day .cnt{display:none}
        .day .bar{height:3px;margin-top:auto}
        .drow{flex-wrap:wrap;gap:5px 9px}
        .dtrk{min-width:0;flex:1}
        .dmeta{width:100%;flex:none}
    }
</style>
