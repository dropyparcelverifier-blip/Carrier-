<script>
    import { onMount } from 'svelte';
    import { role, showToast } from '$lib/stores.js';
    import * as api from '$lib/api.js';
    import HoldBoard from '$lib/HoldBoard.svelte';
    import { stamp, clock, ageDays, labelFor } from '$lib/time.js';
    import Trk from '$lib/Trk.svelte';

    let r = $state('none');
    let loading = $state(true);
    let counts = $state({ all: 0, ok: 0, hold: 0, bad: 0, notDelivered: 0, attention: 0 });
    let days = $state([]);
    let totals = $state({ delivered: 0, scanned: 0, missing: 0, delayed: 0 });
    let covered = $state(new Set());
    let feed = $state([]);
    let openDay = $state('');
    let dayData = $state(null);
    let dayBusy = $state(false);
    let tab = $state('missing');

    role.subscribe(v => r = v);

    onMount(load);

    async function load() {
        loading = true;
        const [c, d] = await Promise.all([api.cohorts(), api.dashboard()]);
        loading = false;

        if (!c.ok) { showToast(c.message || 'Could not load cohorts', 'err'); return; }
        days = c.data.days;
        totals = c.data.totals;
        covered = new Set(c.data.coveredDays);

        if (d.ok) { counts = d.data.counts; feed = d.data.today; }
    }

    async function openCohort(day) {
        if (openDay === day) { openDay = ''; dayData = null; return; }
        openDay = day; dayData = null; dayBusy = true;
        const out = await api.cohortDay(day);
        dayBusy = false;
        if (!out.ok) { showToast(out.message || 'Could not load that day', 'err'); return; }
        dayData = out.data;
        tab = dayData.missing.length ? 'missing' : 'scanned';
    }

    /* ── calendar: last 35 days, marked where a report covered them ── */
    let calendar = $derived.by(() => {
        const out = [];
        const now = new Date();
        for (let i = 34; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            out.push({ key, day: d.getDate(), covered: covered.has(key), today: i === 0 });
        }
        return out;
    });

    let gapCount = $derived(calendar.filter(c => !c.covered).length);
    let tz = $derived(labelFor(r));
</script>

<header class="appbar">
    <div class="appbar-row">
        <div>
            <p class="eyebrow">Jamaica NY · times in {tz}</p>
            <h1>Receiving overview</h1>
        </div>
        <button class="appbar-act" onclick={load}>Reload</button>
    </div>
</header>

<div class="body">
    {#if loading}
        <div class="loading"><div class="spin"></div></div>
    {:else}
        <!-- ══ headline counts ══ -->
        <HoldBoard title="Waiting to be scanned" />

        <div class="divider"><span>Receiving detail</span><i></i></div>

        {#if totals.delayed > 0}
            <div class="alert">
                <div>
                    <div class="alert-h">{totals.delayed} parcel{totals.delayed === 1 ? '' : 's'} open more than 3 days</div>
                    <div class="alert-m">Carrier says delivered, warehouse never scanned it.</div>
                </div>
                <button class="alert-b" onclick={() => api.downloadXlsx('delayed', { days: 3 })}>↓ Excel</button>
            </div>
        {/if}

        <!-- ══ upload calendar ══ -->
        <div class="sec"><h2>Report coverage</h2><span>{gapCount ? `${gapCount} days not covered` : 'last 35 days complete'}</span></div>
        <div class="cal">
            {#each calendar as c}
                <div class="cell" class:on={c.covered} class:now={c.today} title="{c.key}{c.covered ? '' : ' — no report covers this day'}">
                    {c.day}
                </div>
            {/each}
        </div>
        <div class="legend">
            <span><i class="sw on"></i> covered by a report</span>
            <span><i class="sw"></i> no report</span>
        </div>

        <div class="cols" style="margin-top:22px">
            <!-- ══ cohorts ══ -->
            <div>
                <div class="sec" style="margin-top:0">
                    <h2>By order date</h2>
                    <span>{totals.scanned} of {totals.delivered} scanned</span>
                </div>


                {#if days.length === 0}
                    <div class="empty">
                        <div class="empty-ic">▤</div>
                        <h3>Nothing on file</h3>
                        <p>Upload a shipment report to fill the manifest.</p>
                    </div>
                {:else}
                    <div class="rows">
                        {#each days as d}
                            <button class="crow" class:sel={openDay === d.day} onclick={() => openCohort(d.day)}>
                                <span class="cdate">{d.day}</span>

                                <span class="cbar" title="{d.scanned} of {d.delivered} scanned">
                                    <i style="width:{d.delivered ? (d.scanned / d.delivered * 100) : 0}%"></i>
                                </span>
                                <span class="cnum">{d.scanned}/{d.delivered}</span>
                                {#if Number(d.delayed) > 0}
                                    <span class="mark bad">{d.delayed} late</span>
                                {:else if Number(d.missing) > 0}
                                    <span class="mark hold">{d.missing} open</span>
                                {:else}
                                    <span class="mark ok">clear</span>
                                {/if}
                            </button>

                            {#if openDay === d.day}
                                <div class="drill">
                                    {#if dayBusy}
                                        <div class="loading" style="padding:22px"><div class="spin"></div></div>
                                    {:else if dayData}
                                        <div class="chips" style="margin:0 0 10px">
                                            <button class="chip" class:on={tab==='missing'} onclick={() => tab='missing'}>Missing <b>{dayData.missing.length}</b></button>
                                            <button class="chip" class:on={tab==='scanned'} onclick={() => tab='scanned'}>Scanned <b>{dayData.scanned.length}</b></button>
                                            {#if dayData.open.length}
                                                <button class="chip" class:on={tab==='open'} onclick={() => tab='open'}>In transit <b>{dayData.open.length}</b></button>
                                            {/if}
                                            <button class="chip" onclick={() => api.downloadXlsx('day', { day: d.day })}>↓ Excel</button>
                                        </div>

                                        {#each [dayData[tab] ?? []] as list}
                                            {#if list.length === 0}
                                                <p class="none">Nothing in this group.</p>
                                            {:else}
                                                {#each list as p}
                                                    <div class="drow">
                                                        <span class="dtrk"><Trk value={p.tracking_number} /></span>
                                                        <span class="dpo">{p.po_number || '—'}</span>
                                                        {#if p.warehouse_received}
                                                            <span class="dwhen">{stamp(p.warehouse_received_at, r)}</span>
                                                        {:else}
                                                            <span class="mark {ageDays(p.ship_date) > 3 ? 'bad' : 'hold'}">{ageDays(p.ship_date)}d</span>
                                                        {/if}
                                                    </div>
                                                {/each}
                                            {/if}
                                        {/each}
                                    {/if}
                                </div>
                            {/if}
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- ══ today's scans ══ -->
            <div>
                <div class="sec" style="margin-top:0"><h2>Today's intake</h2><span>{feed.length} scan{feed.length === 1 ? '' : 's'}</span></div>
                <div class="feed">
                    <div class="feed-h"><span>Scan log</span><span>{tz}</span></div>
                    {#if feed.length === 0}
                        <div style="padding:26px 12px;text-align:center">
                            <p style="font-family:var(--data);font-size:10px;color:var(--ink2);line-height:1.8">
                                No parcels scanned yet today.<br>The log fills as the warehouse works.
                            </p>
                        </div>
                    {:else}
                        {#each feed.slice(0, 12) as f}
                            <div class="feed-i">
                                <span class="feed-t">{clock(f.scanned_at, r)}</span>
                                <span class="feed-k"><Trk value={f.tracking_number} /></span>
                                <span class="mark ok">In</span>
                            </div>
                        {/each}
                    {/if}
                </div>

                {#if counts.notDelivered > 0 || counts.attention > 0}
                    <div class="sec"><h2>Needs a decision</h2></div>
                    <div class="rows">
                        <a class="nrow" href="/attention">
                            <div class="row-mid">
                                <div class="row-trk">{counts.notDelivered} parcel{counts.notDelivered === 1 ? '' : 's'} flagged by the carrier</div>
                                <div class="row-meta">Not delivered or status unknown</div>
                            </div>
                            <span class="mark bad">Review</span>
                        </a>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .divider{display:flex;align-items:center;gap:12px;margin:28px 0 4px}
    .divider span{font-family:var(--disp);font-size:11px;font-weight:700;letter-spacing:.14em;
        text-transform:uppercase;color:var(--ink2);white-space:nowrap}
    .divider i{flex:1;height:1.5px;background:var(--rule)}

    .alert{display:flex;align-items:center;gap:12px;background:#fff;border:1.5px solid var(--alert);border-left-width:4px;padding:11px 13px;margin-top:14px}
    .alert-h{font-family:var(--disp);font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--alert)}
    .alert-m{font-family:var(--data);font-size:10px;color:var(--ink2);margin-top:3px}
    .alert-b{margin-left:auto;border:1.5px solid var(--alert);background:var(--alert);color:#fff;font-family:var(--disp);font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:8px 13px;white-space:nowrap}

    .cal{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;background:#fff;border:1.5px solid var(--ink);padding:8px}
    @media(min-width:900px){.cal{grid-template-columns:repeat(35,1fr)}}
    .cell{aspect-ratio:1;display:grid;place-items:center;font-family:var(--data);font-size:9px;color:var(--ink3);background:var(--paper3);min-height:22px}
    .cell.on{background:var(--verify);color:#fff}
    .cell.now{outline:2px solid var(--signal);outline-offset:-2px}
    .legend{display:flex;gap:16px;margin-top:6px;font-family:var(--data);font-size:9px;color:var(--ink2)}
    .legend span{display:flex;align-items:center;gap:5px}
    .sw{width:9px;height:9px;background:var(--paper3);display:inline-block}
    .sw.on{background:var(--verify)}

    .crow{width:100%;display:flex;align-items:center;gap:10px;padding:9px 12px;background:#fff;border:none;border-bottom:1px solid var(--rule);text-align:left}
    .crow:last-child{border-bottom:none}
    .crow.sel{background:var(--paper2)}
    .cdate{font-family:var(--data);font-size:11px;font-weight:600;white-space:nowrap}
    .cbar{flex:1;height:6px;background:var(--paper3);min-width:40px}
    .cbar i{display:block;height:100%;background:var(--verify)}
    .cnum{font-family:var(--data);font-size:10px;color:var(--ink2);white-space:nowrap}

    .drill{background:var(--paper2);border-bottom:1px solid var(--rule);padding:11px 12px}
    .drow{display:flex;align-items:center;gap:9px;padding:5px 0;border-bottom:1px dotted var(--rule)}
    .drow:last-child{border-bottom:none}
    .dtrk{font-family:var(--data);font-size:11px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dpo{font-family:var(--data);font-size:10px;color:var(--ink2);white-space:nowrap}
    .dwhen{font-family:var(--data);font-size:9.5px;color:var(--ink2);white-space:nowrap}
    .none{font-family:var(--data);font-size:10px;color:var(--ink2);padding:10px 0}

    .nrow{display:flex;align-items:center;gap:11px;padding:11px 12px;background:#fff;text-decoration:none;color:inherit}
</style>
