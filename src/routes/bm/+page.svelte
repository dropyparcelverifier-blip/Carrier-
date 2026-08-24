<script>
    import { onMount } from 'svelte';
    import { role, showToast } from '$lib/stores.js';
    import { goto } from '$app/navigation';
    import * as api from '$lib/api.js';
    import { labelFor } from '$lib/time.js';

    let r = $state('none');
    let loading = $state(true);
    let days = $state([]);
    let totals = $state(null);
    let available = $state({ rows: [], total: 0 });

    role.subscribe(v => r = v);
    onMount(load);

    async function load() {
        loading = true;
        const [d, a] = await Promise.all([api.bmDays(), api.bmAvailable({ size: 8 })]);
        loading = false;
        if (d.ok) { days = d.data.days; totals = d.data.totals; }
        if (a.ok) available = a.data;
    }

    // Counted in the database. Adding these up in the browser meant the
    // figures stopped at a thousand parcels without saying so.
    let sum = $derived({
        parcels: Number(totals?.parcels ?? 0),
        units: Number(totals?.units ?? 0),
        boxed: Number(totals?.boxed ?? 0),
        sentBefore: Number(totals?.sent_before_parcels ?? 0),
        sentUnits: Number(totals?.sent_before_units ?? 0)
    });

    let waiting = $derived(Math.max(0, sum.units - sum.boxed - sum.sentUnits));

    const ageDays = iso => iso
        ? Math.max(0, Math.floor((Date.now() - new Date(iso + 'T00:00:00Z')) / 864e5)) : 0;
</script>

<header class="appbar">
    <div class="appbar-row">
        <div>
            <p class="eyebrow">Bombino · Costech · Costeck · {labelFor(r)}</p>
            <h1>BM overview</h1>
        </div>
        <button class="appbar-act" onclick={load}>Reload</button>
    </div>
</header>

<div class="body">
    {#if loading}
        <div class="loading"><div class="spin"></div></div>
    {:else}
        <div class="stats">
            <div class="stat"><div class="k">Parcels</div><div class="v">{sum.parcels}</div>
                <div class="d">on file</div></div>
            <div class="stat"><div class="k">Units</div><div class="v">{sum.units}</div>
                <div class="d">ordered</div></div>
            <div class="stat"><div class="k">Boxed</div><div class="v v-bm">{sum.boxed}</div>
                <div class="d">sent on</div></div>
            <div class="stat"><div class="k">Waiting</div><div class="v v-hold">{waiting}</div>
                <div class="d">still to box</div></div>
        </div>

        {#if sum.sentBefore > 0}
            <div class="note" style="margin-top:12px">
                {sum.sentBefore} parcel{sum.sentBefore === 1 ? '' : 's'} marked
                <b>sent before the system</b>. Those stay out of the box builder.
            </div>
        {/if}

        <div class="sec">
            <h2>By order date</h2>
            <span>{sum.boxed} of {sum.units} units boxed</span>
        </div>

        {#if days.length === 0}
            <div class="empty">
                <div class="empty-ic">▤</div>
                <h3>Nothing on file</h3>
                <p>Upload a shipment report — Bombino parcels come through the same file.</p>
            </div>
        {:else}
            <div class="rows">
                {#each days.slice(0, 30) as d}
                    {@const pct = d.units ? Math.round(d.boxed / d.units * 100) : 0}
                    <button class="drow" onclick={() => goto(`/bm/parcels?day=${String(d.day).slice(0, 10)}`)}>
                        <span class="dday">{String(d.day).slice(0, 10)}</span>
                        <span class="dbar"><i style="width:{pct}%"></i></span>
                        <span class="dnum">{d.boxed}/{d.units}</span>
                        {#if d.sent_before}
                            <span class="mark">{d.sent_before} sent before</span>
                        {:else if d.boxed >= d.units}
                            <span class="mark ok">clear</span>
                        {:else if d.boxed === 0}
                            <span class="mark bad">{d.units} waiting</span>
                        {:else}
                            <span class="mark hold">{d.units - d.boxed} left</span>
                        {/if}
                    </button>
                {/each}
            </div>
        {/if}

        {#if available.rows.length}
            <div class="sec">
                <h2>Oldest waiting</h2>
                <span>{available.total} lines available to box</span>
            </div>
            <div class="tblwrap">
                <table class="tbl">
                    <thead><tr>
                        <th style="width:86px">Ordered</th><th style="width:100px">PO</th>
                        <th style="width:118px">ASIN</th><th>Item</th>
                        <th class="num" style="width:48px">Left</th><th style="width:70px">Waiting</th>
                    </tr></thead>
                    <tbody>
                        {#each [...available.rows].sort((a,b) => (a.order_on ?? '').localeCompare(b.order_on ?? '')).slice(0,8) as it}
                            {@const age = ageDays(it.order_on)}
                            <tr>
                                <td class="mono">{it.order_date || '—'}</td>
                                <td class="mono">{it.po_number || '—'}</td>
                                <td>
                                    <a class="asin" href="https://www.amazon.com/dp/{it.asin}"
                                        target="_blank" rel="noopener noreferrer">{it.asin}</a>
                                </td>
                                <td class="ct" title={it.title}>{it.title}</td>
                                <td class="num mono">{it.qty_left}</td>
                                <td><span class="mark {age > 14 ? 'bad' : 'hold'}">{age}d</span></td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
            <button class="act ghost" style="margin-top:10px" onclick={() => goto('/bm/boxes')}>
                Open a box and start packing
            </button>
        {/if}
    {/if}
</div>

<style>
    .v-bm{color:#2563A8}
    .drow{width:100%;display:flex;align-items:center;gap:10px;padding:9px 12px;background:#fff;
        border:none;border-bottom:1px solid var(--rule);text-align:left}
    .drow:last-child{border-bottom:none}
    .drow:hover{background:var(--paper2)}
    .dday{font-family:var(--data);font-size:11px;font-weight:600;white-space:nowrap}
    .dbar{flex:1;height:6px;background:var(--paper3);min-width:40px}
    .dbar i{display:block;height:100%;background:#2563A8}
    .dnum{font-family:var(--data);font-size:10px;color:var(--ink2);white-space:nowrap}
    .tblwrap{overflow-x:auto}
    .tbl{width:100%;border-collapse:collapse;background:#fff;border:1.5px solid var(--ink);min-width:620px}
    .tbl th{background:var(--ink);color:var(--paper);font-family:var(--disp);font-size:9.5px;
        font-weight:600;letter-spacing:.12em;text-transform:uppercase;text-align:left;padding:8px 10px;white-space:nowrap}
    .tbl td{padding:6px 10px;border-bottom:1px solid var(--rule);font-size:12px}
    .tbl .num{text-align:right}
    .tbl .mono{font-family:var(--data);font-size:11px;color:var(--ink2)}
    .ct{max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .asin{font-family:var(--data);font-size:10.5px;color:var(--signal);text-decoration:none;
        border-bottom:1px solid var(--signal);white-space:nowrap}
</style>
