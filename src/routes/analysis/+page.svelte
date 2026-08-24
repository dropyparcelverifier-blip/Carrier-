<script>
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { role, showToast } from '$lib/stores.js';
    import * as api from '$lib/api.js';
    import { stamp, dayShort, labelFor } from '$lib/time.js';
    import OrderIds from '$lib/OrderIds.svelte';

    let r = $state('none');
    let tab = $state('journey');

    /* journey */
    let q = $state('');
    let jLoading = $state(false);
    let j = $state(null);
    let many = $state(null);
    let mTotal = $state(0);
    let mMore = $state(false);
    let mTerm = $state('');
    let searched = $state(false);

    /* weights */
    let wq = $state('');
    let weights = $state([]);
    let wTotal = $state(0);
    let wMore = $state(false);
    let wSort = $state('packed_at');
    let wDir = $state('desc');
    let wLoading = $state(false);

    /* discrepancies */
    let dq = $state('');
    let disc = $state({ rows: [], short: 0, extra: 0, valueDelta: 0 });
    let dLoading = $state(false);

    /* turnaround */
    let tat = $state(null);
    let tLoading = $state(false);

    role.subscribe(v => r = v);

    onMount(() => {
        const t = $page.url.searchParams.get('t');
        if (t) { q = t; runJourney(); }
    });

    /* ══ journey ══ */
    async function runJourney(reset = true) {
        const term = q.trim();
        if (!term) return;
        jLoading = reset;
        if (reset) { j = null; many = null; searched = true; }

        const out = await api.journey(term, { from: reset ? 0 : (many?.length ?? 0), size: 25 });
        jLoading = false;

        if (!out.ok) { showToast(out.message || 'Lookup failed', 'err'); return; }
        if (!out.data.found) { many = null; return; }

        // A tracking number goes straight through; everything else lists first
        if (!out.data.many) { j = out.data; many = null; return; }

        many = reset ? out.data.many : [...(many ?? []), ...out.data.many];
        mTotal = out.data.total;
        mMore = out.data.more;
        mTerm = out.data.term;
    }

    /** Opening a result asks for it by tracking number, which is exact. */
    async function pick(t) {
        jLoading = true; many = null;
        const out = await api.journey(t);
        jLoading = false;
        if (out.ok && out.data.found && !out.data.many) j = out.data;
        else showToast('Could not open that parcel', 'err');
    }

    function backToResults() { j = null; runJourney(true); }

    /** The stub figures — total time, and how long it sat waiting to be packed.
     *  The waiting number is the one worth acting on. */
    /** True when the trace ends at "sent before this system" — finished, but
     *  handled by hand rather than packed here. */
    let sentBefore = $derived(!!j?.stages?.some(s => s.key === 'sent_before'));

    let stub = $derived.by(() => {
        if (!j) return null;
        const st = Object.fromEntries(j.stages.map(s => [s.key, s.at]));
        const days = (a, b) => (a && b) ? Math.round((new Date(b) - new Date(a)) / 864e5) : null;
        const end = st.closed ?? st.boxed ?? st.scanned ?? null;
        return {
            total: days(st.ordered, end),
            waiting: days(st.scanned, st.boxed),
            reached: j.stages.filter(s => s.reached).length
        };
    });

    /* ══ weights ══ */
    async function loadWeights(reset = true) {
        wLoading = true;
        const out = await api.weightMap({
            q: wq.trim(), sort: wSort, dir: wDir,
            from: reset ? 0 : weights.length, size: 60
        });
        wLoading = false;
        if (!out.ok) { showToast(out.message || 'Could not load', 'err'); return; }
        weights = reset ? out.data.rows : [...weights, ...out.data.rows];
        wTotal = out.data.total;
        wMore = out.data.more;
    }

    function sortBy(col) {
        if (wSort === col) wDir = wDir === 'desc' ? 'asc' : 'desc';
        else { wSort = col; wDir = 'desc'; }
        loadWeights(true);
    }

    let wTimer;
    function wTyped() { clearTimeout(wTimer); wTimer = setTimeout(() => loadWeights(true), 280); }

    /* ══ discrepancies / turnaround ══ */
    async function loadDisc() {
        dLoading = true;
        const out = await api.discrepancies(dq.trim());
        dLoading = false;
        if (out.ok) disc = out.data;
    }
    async function loadTat() {
        tLoading = true;
        const out = await api.turnaround();
        tLoading = false;
        if (out.ok) tat = out.data;
    }

    function go(t) {
        tab = t;
        if (t === 'weights' && !weights.length) loadWeights(true);
        if (t === 'discrepancies' && !disc.rows.length) loadDisc();
        if (t === 'turnaround' && !tat) loadTat();
    }

    let peak = $derived(tat ? Math.max(...tat.buckets, 1) : 1);
    const money = v => '$' + Number(v ?? 0).toFixed(2);
    const short = (s, n = 46) => (s && s.length > n ? s.slice(0, n) + '…' : (s ?? ''));
</script>

<header class="appbar">
    <div class="appbar-row">
        <div><p class="eyebrow">Times in {labelFor(r)}</p><h1>Analysis</h1></div>
    </div>
</header>

<div class="body">
    <div class="chips" style="margin-top:0">
        <button class="chip" class:on={tab==='journey'} onclick={() => go('journey')}>Journey</button>
        <button class="chip" class:on={tab==='weights'} onclick={() => go('weights')}>Weight map</button>
        <button class="chip" class:on={tab==='discrepancies'} onclick={() => go('discrepancies')}>Discrepancies</button>
        <button class="chip" class:on={tab==='turnaround'} onclick={() => go('turnaround')}>Turnaround</button>
    </div>

    <!-- ══════════ JOURNEY ══════════ -->
    {#if tab === 'journey'}
        <div class="field">
            <label for="jq">Find</label>
            <input id="jq" bind:value={q} placeholder="Tracking, PO, order ID or item name"
                autocomplete="off" spellcheck="false"
                onkeydown={(e) => e.key === 'Enter' && runJourney()} />
            <button class="field-btn" onclick={runJourney}>Trace</button>
        </div>

        {#if jLoading}
            <div class="loading"><div class="spin"></div></div>

        {:else if many}
            <div class="sec">
                <h2>{mTotal} {mTotal === 1 ? 'parcel' : 'parcels'} match "{mTerm}"</h2>
                <span>{many.length === mTotal ? 'all shown' : `showing ${many.length}, newest first`}</span>
            </div>
            <div class="tblwrap">
                <table class="tbl">
                    <thead><tr>
                        <th style="width:92px">Ordered</th>
                        <th style="width:98px">PO</th>
                        <th style="width:152px">Tracking</th>
                        <th>What matched</th>
                        <th class="num" style="width:50px">Qty</th>
                        <th style="width:92px">Status</th>
                    </tr></thead>
                    <tbody>
                        {#each many as p}
                            <tr onclick={() => pick(p.tracking_number)}>
                                <td class="mono">{p.order_date || '—'}</td>
                                <td class="mono">{p.delivery_on ? dayShort(p.delivery_on, r) : '—'}</td>
                                <td class="mono">{p.po_number || '—'}</td>
                                <td class="mono">
                                    {p.tracking_number}
                                    <OrderIds ids={p.order_ids} compact />
                                </td>
                                <td>
                                    {#if p.matches.length === 0}
                                        <span class="viaparcel">matched the {p.po_number ? 'PO' : 'tracking number'}</span>
                                    {:else}
                                        {#each p.matches as m}
                                            <div class="hit" title={m.title}>{m.title}</div>
                                        {/each}
                                    {/if}
                                </td>
                                <td class="num mono">
                                    {p.matches.length
                                        ? p.matches.reduce((s, m) => s + (Number(m.quantity) || 0), 0)
                                        : p.item_count}
                                </td>
                                <td>
                                    <span class="mark {p.box_id ? 'ok' : p.warehouse_received ? 'hold' : 'bad'}">
                                        {p.box_id ? 'Boxed' : p.warehouse_received ? 'On hand' : 'Awaited'}
                                    </span>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
            {#if mMore}
                <button class="act ghost" style="margin-top:10px" onclick={() => runJourney(false)}>
                    Show more — {mTotal - many.length} left
                </button>
            {/if}

        {:else if j}
            <!-- ══ the ticket ══ -->
            {#if mTotal > 1}
                <button class="backlink" onclick={backToResults}>‹ Back to {mTotal} results</button>
            {/if}
            <div class="ticket">
                <div class="tleft">
                    <div class="tktop">
                        <span class="tktrk">{j.parcel.tracking_number}</span>
                        <span class="tkpo">{j.parcel.po_number || 'No PO'} · {j.parcel.carrier || '—'}</span>
                        <div class="tkorders"><OrderIds ids={j.parcel.order_ids} /></div>
                    </div>

                    <div class="tsteps">
                        {#each j.stages as s, i}
                            <div class="tseg" class:done={s.reached && s.at}
                                class:reached={s.reached && !s.at}
                                class:now={s.reached && i === stub.reached - 1 && s.key !== 'sent_before'}
                                class:before={s.key === 'sent_before'}
                                style="animation-delay:{i * 0.09}s">
                                <span>{s.label.split(' ')[0]}</span>
                            </div>
                        {/each}
                    </div>
                    <div class="tlabels">
                        {#each j.stages as s}
                            <div class="tlab">
                                {#if s.at}{s.dateOnly ? dayShort(s.at, r) : stamp(s.at, r).split(',')[0]}
                                {:else if s.reached}reached
                                {:else}—{/if}
                                {#if s.gapDays > 0}<em>+{s.gapDays}d</em>{/if}
                            </div>
                        {/each}
                    </div>

                    <div class="tfacts">
                        {#each j.stages.filter(s => s.at) as s}
                            <div><div class="tk">{s.label}</div>
                                <div class="tv">{s.dateOnly ? dayShort(s.at, r) : stamp(s.at, r)}</div></div>
                        {/each}
                    </div>
                </div>

                <div class="tright">
                    <div class="tk">Total time</div>
                    <div class="tv big">{stub.total != null ? stub.total + ' days' : '—'}</div>
                    <div class="tk" style="margin-top:13px">Sat waiting</div>
                    <div class="tv big" class:warn={stub.waiting > 5}>
                        {stub.waiting != null ? stub.waiting + ' days' : '—'}
                    </div>
                    <div class="tk" style="margin-top:13px">Box</div>
                    <div class="tv sm">
                        {sentBefore ? 'handled by hand' : (j.parcel.box_id || 'not packed')}
                    </div>
                    <div class="tk" style="margin-top:13px">Status</div>
                    <div style="margin-top:4px">
                        {#if sentBefore}
                            <!-- finished, just not through this system -->
                            <span class="mark">Sent before</span>
                        {:else}
                            <span class="mark {j.box?.status === 'closed' ? 'ok' : j.parcel.box_id ? 'hold' : 'bad'}">
                                {j.box?.status === 'closed' ? 'Shipped' : j.parcel.box_id ? 'Packing' : 'Open'}
                            </span>
                        {/if}
                    </div>
                </div>
            </div>

            <!-- contents and scans -->
            <div class="cols">
                <div class="panel">
                    <div class="phead"><span>What is inside</span><span>{j.items.length}</span></div>
                    {#if j.items.length === 0}
                        <p class="none">No item detail on file.</p>
                    {:else}
                        {#each j.items as it}
                            {@const p = j.packed.find(x => x.asin === it.asin)}
                            <div class="prow">
                                <span class="pt">
                                    {it.title}
                                    {#if p?.qty_reason}
                                        <span class="reason">{p.qty_reason}</span>
                                    {/if}
                                </span>
                                {#if it.asin}
                                    <a class="asin" href="https://www.amazon.com/dp/{it.asin}"
                                        target="_blank" rel="noopener noreferrer">{it.asin}</a>
                                {/if}
                                <span class="mono">{it.quantity}×</span>
                                {#if p}
                                    <span class="mark {p.qty_actual === p.qty_expected ? 'ok' : 'bad'}">
                                        packed {p.qty_actual}{p.weight_g ? ` · ${p.weight_g}g` : ''}
                                    </span>
                                {/if}
                            </div>
                        {/each}
                    {/if}
                </div>

                <div class="panel">
                    <div class="phead"><span>Scan history</span><span>{j.scans.length}</span></div>
                    {#if j.scans.length === 0}
                        <p class="none">Never scanned.</p>
                    {:else}
                        {#each j.scans as s}
                            <div class="prow">
                                <span class="mono">{stamp(s.scanned_at, r)}</span>
                                <span class="pt mono">{s.scanned_by || '—'}</span>
                                <span class="mark {s.action === 'received' ? 'ok' : s.action === 'duplicate' ? 'hold' : 'bad'}">
                                    {s.action === 'received' ? 'Received' : s.action === 'duplicate' ? 'Repeat' : 'No match'}
                                </span>
                            </div>
                        {/each}
                    {/if}
                </div>
            </div>

            {#if j.parcel.attention_state}
                <div class="note" style="border-left-color:var(--hold);margin-top:14px">
                    Marked <b>{j.parcel.attention_state.replace('_',' ')}</b> by {j.parcel.attention_by || '—'}
                    on {stamp(j.parcel.attention_at, r)}{j.parcel.attention_note ? ` — ${j.parcel.attention_note}` : ''}
                </div>
            {/if}

        {:else if searched}
            <div class="empty"><div class="empty-ic">▤</div><h3>Nothing found</h3>
                <p>No parcel matches that tracking number, PO, order ID or item name.</p></div>
        {:else}
            <div class="note">
                Trace one parcel from the day it was ordered to the box that carried it.
                Searching an item name or a PO returns everything that matches.
            </div>
        {/if}

    <!-- ══════════ WEIGHT MAP ══════════ -->
    {:else if tab === 'weights'}
        <div class="field">
            <label for="wq">Find</label>
            <input id="wq" bind:value={wq} oninput={wTyped}
                placeholder="Box, PO, ASIN, order ID or item name"
                autocomplete="off" spellcheck="false" />
        </div>
        <div class="sec"><h2>Every weighing</h2><span>{wTotal} recorded</span></div>

        {#if weights.length === 0 && !wLoading}
            <div class="empty"><div class="empty-ic">▤</div><h3>Nothing weighed yet</h3>
                <p>Weights recorded while packing build this list automatically.</p></div>
        {:else}
            <div class="tblwrap">
                <table class="tbl">
                    <thead><tr>
                        {#each [['box_id','Box'],['packed_at','Date'],['po_number','PO'],['asin','ASIN'],['title','Item']] as [c,l]}
                            <th onclick={() => sortBy(c)}>{l}{#if wSort===c}<span class="ar">{wDir==='desc'?'▾':'▴'}</span>{/if}</th>
                        {/each}
                        <th class="num" onclick={() => sortBy('weight_per_unit')}>Wt/unit{#if wSort==='weight_per_unit'}<span class="ar">{wDir==='desc'?'▾':'▴'}</span>{/if}</th>
                        <th class="num" onclick={() => sortBy('qty_actual')}>Qty{#if wSort==='qty_actual'}<span class="ar">{wDir==='desc'?'▾':'▴'}</span>{/if}</th>
                    </tr></thead>
                    <tbody>
                        {#each weights as w, i}
                            <tr class:newbox={i > 0 && weights[i-1].box_id !== w.box_id}>
                                <td class="mono">{w.box_id}</td>
                                <td class="mono">{dayShort(w.packed_at, r)}</td>
                                <td class="mono">{w.po_number || '—'}</td>
                                <td>
                                    <a class="asin" href="https://www.amazon.com/dp/{w.asin}"
                                        target="_blank" rel="noopener noreferrer">{w.asin}</a>
                                </td>
                                <td class="ct" title={w.title}>{w.title}</td>
                                <td class="num mono">{w.weight_per_unit} g</td>
                                <td class="num mono">{w.qty_actual}</td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
            {#if wMore}
                <button class="act ghost" style="margin-top:10px" onclick={() => loadWeights(false)}>
                    {wLoading ? 'Loading…' : `Show more — ${wTotal - weights.length} left`}
                </button>
            {/if}
        {/if}

    <!-- ══════════ DISCREPANCIES ══════════ -->
    {:else if tab === 'discrepancies'}
        <div class="field">
            <label for="dq">Find</label>
            <input id="dq" bind:value={dq} placeholder="Tracking, PO, ASIN or item"
                onkeydown={(e) => e.key === 'Enter' && loadDisc()} />
            <button class="field-btn" onclick={loadDisc}>Search</button>
        </div>
        {#if dLoading}
            <div class="loading"><div class="spin"></div></div>
        {:else}
            <div class="stats" style="grid-template-columns:repeat(3,1fr);margin-top:12px">
                <div class="stat"><div class="k">Short</div><div class="v v-bad" style="font-size:22px">{disc.short}</div><div class="d">fewer than ordered</div></div>
                <div class="stat"><div class="k">Extra</div><div class="v v-hold" style="font-size:22px">{disc.extra}</div><div class="d">more than ordered</div></div>
                <div class="stat"><div class="k">Value</div><div class="v" style="font-size:22px">{money(disc.valueDelta)}</div><div class="d">net difference</div></div>
            </div>
            {#if disc.rows.length === 0}
                <div class="empty" style="margin-top:14px"><div class="empty-ic">✓</div>
                    <h3>Every box matched the order</h3>
                    <p>No packer has recorded a quantity different from what was expected.</p></div>
            {:else}
                <div class="sec"><h2>Mismatches</h2><span>{disc.rows.length}</span></div>
                <div class="rows">
                    {#each disc.rows as d}
                        <div class="irow">
                            <div class="ititle">{d.title || d.asin}</div>
                            <div class="imeta">
                                <span>{d.box_id}</span><span>{d.tracking_number}</span>
                                <span>{d.po_number || '—'}</span>
                                <span class="mark {d.delta < 0 ? 'bad' : 'hold'}">
                                    ordered {d.qty_expected}, packed {d.qty_actual}
                                </span>
                                {#if d.value_delta}<span>{money(d.value_delta)}</span>{/if}
                                <span>{d.packer_name || d.packed_by || '—'}</span>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        {/if}

    <!-- ══════════ TURNAROUND ══════════ -->
    {:else}
        {#if !tat}
            <div class="loading"><div class="spin"></div></div>
        {:else}
            <div class="stats" style="grid-template-columns:repeat(4,1fr)">
                <div class="stat"><div class="k">Boxed</div><div class="v" style="font-size:24px">{tat.boxedCount}</div><div class="d">parcels shipped on</div></div>
                <div class="stat"><div class="k">Median</div><div class="v v-ok" style="font-size:24px">{tat.medianDays ?? '—'}</div><div class="d">days to box</div></div>
                <div class="stat"><div class="k">Average</div><div class="v" style="font-size:24px">{tat.avgDays ?? '—'}</div><div class="d">days to box</div></div>
                <div class="stat"><div class="k">Waiting</div><div class="v v-hold" style="font-size:24px">{tat.waitingCount}</div><div class="d">on hand, unboxed</div></div>
            </div>
            <div class="note">
                Counted from the moment a parcel is scanned at Jamaica to the moment its box is
                closed. Median matters more than average — one parcel forgotten for a month drags
                the average and tells you nothing about the usual case.
            </div>
            <div class="sec"><h2>How long it takes</h2><span>{tat.boxedCount} parcels</span></div>
            <div class="dist">
                {#each tat.buckets as b, i}
                    <div class="drowb">
                        <span class="dlabel">{tat.labels[i]}</span>
                        <span class="dbar"><i style="width:{b / peak * 100}%"></i></span>
                        <span class="dcount">{b}</span>
                    </div>
                {/each}
            </div>
            {#if tat.aging.length}
                <div class="sec"><h2>Waiting longest</h2><span>on hand, not yet boxed</span></div>
                <div class="rows">
                    {#each tat.aging as a}
                        <div class="row">
                            <span class="row-mid" style="font-family:var(--data);font-size:11px;font-weight:600">{a.tracking_number}</span>
                            <span class="mono">{a.po_number || '—'}</span>
                            <span class="mark {a.waitingDays > 5 ? 'bad' : 'hold'}">{a.waitingDays}d</span>
                        </div>
                    {/each}
                </div>
            {/if}
        {/if}
    {/if}
</div>

<style>
    .hit{font-size:12px;line-height:1.4;padding:1px 0;overflow:hidden;
        text-overflow:ellipsis;white-space:nowrap;max-width:100%}
    .hit + .hit{border-top:1px dotted var(--rule);margin-top:2px;padding-top:3px}
    .viaparcel{font-family:var(--data);font-size:10.5px;color:var(--ink3)}
    .backlink{border:none;background:none;padding:0;margin:14px 0 0;
        font-family:var(--disp);font-size:11px;font-weight:700;letter-spacing:.1em;
        text-transform:uppercase;color:var(--signal)}

    /* ── the ticket ── */
    .ticket{border:1.5px solid var(--ink);background:#fff;display:flex;flex-wrap:wrap;margin-top:14px}
    .tleft{flex:1;min-width:300px;padding:16px 18px;border-right:1.5px dashed var(--rule)}
    .tright{width:200px;padding:16px 18px;background:var(--paper2)}
    .tktop{margin-bottom:14px}
    .tktrk{font-family:var(--data);font-size:18px;font-weight:600;display:block}
    .tkpo{font-family:var(--data);font-size:10.5px;color:var(--ink2)}
    .tkorders{margin-top:5px}

    .tsteps{display:flex;gap:2px}
    .tseg{flex:1;height:30px;background:var(--paper3);display:grid;place-items:center;
        transform:scaleX(0);transform-origin:left;animation:wipe .3s ease forwards}
    @keyframes wipe{to{transform:scaleX(1)}}
    .tseg.done,.tseg.reached{background:var(--verify)}
    .tseg.reached{background:#5FA98C}
    .tseg.now{background:var(--signal)}
    /* handled outside this system — finished, but not by us */
    .tseg.before{background:#5A5C63}
    .tseg span{font-family:var(--disp);font-size:8.5px;font-weight:700;letter-spacing:.08em;
        text-transform:uppercase;color:#fff;padding:0 2px;text-align:center}
    .tseg:not(.done):not(.reached):not(.now) span{color:var(--ink3)}
    .tlabels{display:flex;gap:2px;margin-top:5px}
    .tlab{flex:1;text-align:center;font-family:var(--data);font-size:8.5px;color:var(--ink2);line-height:1.5}
    .tlab em{display:block;font-style:normal;color:var(--signal)}

    .tfacts{display:flex;gap:22px;margin-top:16px;flex-wrap:wrap}
    .tk{font-family:var(--data);font-size:8px;letter-spacing:.15em;text-transform:uppercase;color:var(--ink2)}
    .tv{font-family:var(--data);font-size:13px;font-weight:600;margin-top:2px}
    .tv.big{font-size:19px}
    .tv.sm{font-size:11px}
    .tv.warn{color:var(--alert)}
    .mark{font-family:var(--disp);font-size:9px;font-weight:700;letter-spacing:.1em;
        text-transform:uppercase;padding:2px 6px;border:1.5px solid var(--ink3);
        color:var(--ink2);display:inline-block;white-space:nowrap}

    .cols{display:grid;grid-template-columns:1.3fr 1fr;gap:16px;margin-top:16px}
    .panel{border:1.5px solid var(--ink);background:#fff}
    .phead{background:var(--ink);color:var(--paper);padding:8px 12px;font-family:var(--disp);
        font-size:10px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;
        display:flex;justify-content:space-between}
    .prow{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--rule);font-size:12px}
    .prow:last-child{border-bottom:none}
    .pt{flex:1;min-width:0}
    .mono{font-family:var(--data);font-size:10.5px;color:var(--ink2);white-space:nowrap}
    .asin{font-family:var(--data);font-size:10.5px;color:var(--signal);text-decoration:none;
        border-bottom:1px solid var(--signal);white-space:nowrap}
    .reason{display:inline-block;font-family:var(--data);font-size:9px;background:#FDF3EC;
        color:var(--signal);border:1px solid var(--signal);padding:1px 6px;margin-left:6px}
    .none{padding:14px 12px;font-family:var(--data);font-size:10.5px;color:var(--ink2)}

    /* ── tables ── */
    .tblwrap{overflow-x:auto}
    .tbl{width:100%;border-collapse:collapse;background:#fff;border:1.5px solid var(--ink);min-width:640px}
    .tbl th{background:var(--ink);color:var(--paper);font-family:var(--disp);font-size:9.5px;
        font-weight:600;letter-spacing:.12em;text-transform:uppercase;text-align:left;
        padding:8px 10px;white-space:nowrap;cursor:pointer}
    .tbl th .ar{color:var(--signal);margin-left:4px}
    .tbl td{padding:6px 10px;border-bottom:1px solid var(--rule);font-size:12px}
    .tbl tbody tr:hover{background:var(--paper2)}
    .tbl .num{text-align:right}
    .tbl .mono{font-family:var(--data);font-size:11px;color:var(--ink)}
    .tbl .ct{max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .newbox td{border-top:1.5px solid var(--ink3)}

    .irow{padding:10px 12px;border-bottom:1px solid var(--rule);background:#fff}
    .irow:last-child{border-bottom:none}
    .ititle{font-size:12.5px;font-weight:600;line-height:1.35}
    .imeta{display:flex;flex-wrap:wrap;gap:5px 10px;align-items:center;font-family:var(--data);
        font-size:10px;color:var(--ink2);margin-top:5px}

    .dist{border:1.5px solid var(--ink);background:#fff;padding:12px}
    .drowb{display:flex;align-items:center;gap:10px;padding:4px 0}
    .dlabel{font-family:var(--data);font-size:10px;color:var(--ink2);width:72px;flex-shrink:0}
    .dbar{flex:1;height:12px;background:var(--paper3)}
    .dbar i{display:block;height:100%;background:var(--verify)}
    .dcount{font-family:var(--data);font-size:11px;font-weight:600;width:38px;text-align:right}

    @media (max-width:820px){ .cols{grid-template-columns:1fr} .tright{width:100%} }
</style>
