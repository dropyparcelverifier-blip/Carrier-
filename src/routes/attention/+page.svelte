<script>
    import { onMount } from 'svelte';
    import { role, who, showToast } from '$lib/stores.js';
    import * as api from '$lib/api.js';
    import { stamp, ageDays, labelFor } from '$lib/time.js';
    import Trk from '$lib/Trk.svelte';
    import OrderIds from '$lib/OrderIds.svelte';

    let r = $state('none');
    let me = $state('');
    who.subscribe(v => me = v);
    let loading = $state(true);
    let notDelivered = $state([]);
    let goneQuiet = $state([]);
    let stillEarly = $state([]);
    let quietDays = $state(5);
    let showEarly = $state(false);
    let scans = $state([]);
    let settled = $state([]);
    let tab = $state('parcels');
    let busy = $state(false);
    let showJunk = $state(false);
    let note = $state('');
    let showNote = $state(false);

    /** Selected tracking numbers, across every group.
     *  Always replaced rather than mutated, so reactivity fires. */
    let picked = $state(new Set());

    role.subscribe(v => r = v);
    onMount(load);

    async function load(spinner = true) {
        if (spinner) loading = true;
        const out = await api.attention();
        if (spinner) loading = false;
        if (!out.ok) { showToast(out.message || 'Could not load', 'err'); return; }
        notDelivered = out.data.notDelivered;
        goneQuiet = out.data.goneQuiet;
        stillEarly = out.data.stillEarly;
        quietDays = out.data.quietDays;
        scans = out.data.scans;
        settled = out.data.settled;

        // Keep whatever is still on screen selected. Clearing outright meant
        // settling one row threw away a selection built up over dozens of
        // others, and the work had to start again.
        const alive = new Set([
            ...notDelivered.map(p => p.tracking_number),
            ...goneQuiet.map(p => p.tracking_number),
            ...stillEarly.map(p => p.tracking_number)
        ]);
        picked = new Set([...picked].filter(t => alive.has(t)));
    }

    /* ── groups ──
       Only two piles ask for a decision. A parcel with no status that
       shipped yesterday is simply in transit — flagging it buries the
       ones that genuinely need chasing. */
    let grouped = $derived([
        {
            key: 'not_delivered',
            name: 'Not delivered',
            why: 'The carrier tried and failed — usually a refusal, a bad address or a return to sender.',
            rows: notDelivered
        },
        {
            key: 'gone_quiet',
            name: `No status for ${quietDays}+ days`,
            why: `The carrier stopped reporting and has been silent ${quietDays} days or more. Worth chasing.`,
            rows: goneQuiet
        }
    ].filter(g => g.rows.length));

    let actionable = $derived(notDelivered.length + goneQuiet.length);

    let plausible = $derived(scans.filter(s => s.plausible));
    let junk = $derived(scans.filter(s => !s.plausible));

    let pickedList = $derived([...picked]);
    let anyPicked = $derived(pickedList.length > 0);

    /* ── selection ── */
    function toggle(t) {
        const next = new Set(picked);
        next.has(t) ? next.delete(t) : next.add(t);
        picked = next;
    }

    function toggleGroup(rows) {
        const keys = rows.map(x => x.tracking_number);
        const all = keys.every(k => picked.has(k));
        const next = new Set(picked);
        keys.forEach(k => all ? next.delete(k) : next.add(k));
        picked = next;
    }

    const groupAll = rows => rows.length > 0 && rows.every(x => picked.has(x.tracking_number));
    const groupSome = rows => rows.some(x => picked.has(x.tracking_number));

    function clearPick() { picked = new Set(); }

    /* ── actions ── */
    async function settleMany(state) {
        if (!anyPicked) return;
        busy = true;
        const out = await api.settleMany(pickedList, state, note);
        busy = false;
        if (!out.ok) { showToast(out.message || 'Could not save', 'err'); return; }
        showToast(`${out.data.done} settled`, 'ok');
        note = ''; showNote = false;
        // Drop them from view immediately, then reconcile quietly
        const gone = new Set(pickedList);
        notDelivered = notDelivered.filter(p => !gone.has(p.tracking_number));
        goneQuiet = goneQuiet.filter(p => !gone.has(p.tracking_number));
        picked = new Set();
        load(false);
    }

    async function settleOne(tracking, state) {
        busy = true;
        const out = await api.settle(tracking, state, '');
        busy = false;
        if (!out.ok) { showToast(out.message || 'Could not save', 'err'); return; }
        showToast('Settled', 'ok');

        // The row is already gone from the list; refetching only to remove it
        // again costs a round trip and used to reset the page under you.
        const gone = [...notDelivered, ...goneQuiet, ...stillEarly]
            .find(p => p.tracking_number === tracking);

        notDelivered = notDelivered.filter(p => p.tracking_number !== tracking);
        goneQuiet = goneQuiet.filter(p => p.tracking_number !== tracking);
        stillEarly = stillEarly.filter(p => p.tracking_number !== tracking);

        if (picked.has(tracking)) {
            const n = new Set(picked); n.delete(tracking); picked = n;
        }

        // Show it in Settled straight away rather than waiting for a reload
        if (gone) {
            settled = [{
                ...gone, attention_state: state, attention_note: '',
                attention_by: me, attention_at: new Date().toISOString()
            }, ...settled];
        }
    }

    async function dismissMany() {
        if (!anyPicked) return;
        busy = true;
        const out = await api.dismissMany(pickedList);
        busy = false;
        if (!out.ok) { showToast(out.message || 'Could not dismiss', 'err'); return; }
        showToast(`${out.data.done} dismissed`, 'ok');
        await load();
    }

    async function dismissOne(tracking) {
        busy = true;
        const out = await api.dismissScan(tracking);
        busy = false;
        if (!out.ok) { showToast('Could not dismiss', 'err'); return; }
        await load();
    }

    async function reopen(tracking) {
        busy = true;
        const out = await api.unsettle(tracking);
        busy = false;
        if (!out.ok) { showToast('Could not reopen', 'err'); return; }
        showToast('Back in the working list', 'ok');
        await load();
    }

    function switchTab(t) { tab = t; clearPick(); }

    const STATE_LABEL = { cancelled: 'Cancelled', on_hold: 'On hold', resolved: 'Resolved' };
</script>

<header class="appbar">
    <div class="appbar-row">
        <div>
            <p class="eyebrow">Times in {labelFor(r)}</p>
            <h1>Need attention</h1>
        </div>
        <button class="appbar-act" onclick={load}>Reload</button>
    </div>
</header>

<div class="body">
    <div class="chips" style="margin-top:0">
        <button class="chip" class:on={tab==='parcels'} onclick={() => switchTab('parcels')}>Parcels <b>{actionable}</b></button>
        <button class="chip" class:on={tab==='scans'} onclick={() => switchTab('scans')}>Scans <b>{plausible.length}</b></button>
        <button class="chip" class:on={tab==='settled'} onclick={() => switchTab('settled')}>Settled <b>{settled.length}</b></button>
    </div>

    <!-- ══ sticky bulk bar ══ -->
    {#if anyPicked && tab !== 'settled'}
        <div class="selbar">
            <span class="n">{pickedList.length} selected</span>
            <span class="sp"></span>
            {#if tab === 'parcels'}
                <button class="sb x" disabled={busy} onclick={() => settleMany('cancelled')}>Cancelled</button>
                <button class="sb h" disabled={busy} onclick={() => settleMany('on_hold')}>On hold</button>
                <button class="sb v" disabled={busy} onclick={() => settleMany('resolved')}>Delivered</button>
                <button class="sb" onclick={() => showNote = !showNote}>{showNote ? '×' : 'Note'}</button>
            {:else}
                <button class="sb x" disabled={busy} onclick={dismissMany}>Dismiss</button>
            {/if}
            <button class="sb" onclick={clearPick}>Clear</button>
        </div>
        {#if showNote && tab === 'parcels'}
            <input class="ninput" bind:value={note} placeholder="Note applied to all {pickedList.length} (optional)" />
        {/if}
    {/if}

    {#if loading}
        <div class="loading"><div class="spin"></div></div>

    <!-- ══════ parcels, grouped ══════ -->
    {:else if tab === 'parcels'}
        {#if actionable === 0}
            <div class="empty">
                <div class="empty-ic">✓</div>
                <h3>Nothing to decide</h3>
                <p>
                    No failed deliveries, and nothing silent for {quietDays} days or more.
                    {#if stillEarly.length}<br>{stillEarly.length} parcel{stillEarly.length === 1 ? ' is' : 's are'} still in normal transit.{/if}
                </p>
            </div>
        {:else}
            <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
                <button class="lnk" onclick={() => api.downloadXlsx('attention')}>↓ Download as Excel</button>
            </div>

            {#each grouped as g}
                <div class="grp">
                    <div class="grph">
                        <button class="cbx" class:on={groupAll(g.rows)} class:part={!groupAll(g.rows) && groupSome(g.rows)}
                            onclick={() => toggleGroup(g.rows)} aria-label="Select all in {g.name}">
                            {groupAll(g.rows) ? '✓' : groupSome(g.rows) ? '–' : ''}
                        </button>
                        <h2>{g.name}</h2>
                        <span class="cnt">{g.rows.length}</span>
                    </div>
                    <p class="why">{g.why}</p>

                    {#each g.rows as p}
                        {@const age = ageDays(p.ship_date)}
                        <div class="grow" class:sel={picked.has(p.tracking_number)}>
                            <button class="cbx" class:on={picked.has(p.tracking_number)}
                                onclick={() => toggle(p.tracking_number)} aria-label="Select {p.tracking_number}">
                                {picked.has(p.tracking_number) ? '✓' : ''}
                            </button>
                            <span class="gtrk"><Trk value={p.tracking_number} /></span>
                            <span class="gpo">{p.po_number || '—'}</span>
                            <span class="gmeta">{p.carrier || '—'} · {p.item_count} pcs · {p.shipment_date || '—'}</span>
                            <OrderIds ids={p.order_ids} compact />
                            <span class="mark {age > 3 ? 'bad' : 'hold'}">{age}d</span>
                            <span class="gacts">
                                <button class="ab x" disabled={busy} onclick={() => settleOne(p.tracking_number, 'cancelled')}>Canc</button>
                                <button class="ab h" disabled={busy} onclick={() => settleOne(p.tracking_number, 'on_hold')}>Hold</button>
                                <button class="ab v" disabled={busy} onclick={() => settleOne(p.tracking_number, 'resolved')}>Del</button>
                            </span>
                        </div>
                    {/each}
                </div>
            {/each}
        {/if}

        {#if stillEarly.length}
            <button class="junk" onclick={() => showEarly = !showEarly}>
                {showEarly ? '▾' : '▸'} {stillEarly.length} still in normal transit — no status yet, under {quietDays} days
            </button>
            {#if showEarly}
                <div class="grp quiet">
                    <div class="grph" style="padding-left:12px">
                        <h2>Too soon to chase</h2>
                        <span class="cnt">{stillEarly.length}</span>
                    </div>
                    <p class="why">
                        The carrier hasn't reported on these yet, which is normal this soon after shipping.
                        They move up automatically once they pass {quietDays} days.
                    </p>
                    {#each stillEarly as p}
                        <div class="grow">
                            <span class="gtrk" style="color:var(--ink2)">{p.tracking_number}</span>
                            <span class="gpo">{p.po_number || '—'}</span>
                            <span class="gmeta">{p.carrier || '—'} · shipped {p.shipment_date || '—'}</span>
                            <span class="mark hold">{p.days_open ?? ageDays(p.ship_date)}d</span>
                        </div>
                    {/each}
                </div>
            {/if}
        {/if}

    <!-- ══════ unmatched scans ══════ -->
    {:else if tab === 'scans'}
        {#if plausible.length === 0 && junk.length === 0}
            <div class="empty">
                <div class="empty-ic">✓</div>
                <h3>Everything matched</h3>
                <p>Every scan the warehouse made lines up with a parcel on file.</p>
            </div>
        {:else}
            {#if plausible.length}
                <div class="grp">
                    <div class="grph">
                        <button class="cbx" class:on={groupAll(plausible)} class:part={!groupAll(plausible) && groupSome(plausible)}
                            onclick={() => toggleGroup(plausible)} aria-label="Select all">
                            {groupAll(plausible) ? '✓' : groupSome(plausible) ? '–' : ''}
                        </button>
                        <h2>Scanned, not on file</h2>
                        <span class="cnt">{plausible.length}</span>
                    </div>
                    <p class="why">
                        Someone physically held these, but no report mentions them. They clear on their own
                        once a later report lands, dated to the original scan.
                    </p>
                    {#each plausible as s}
                        <div class="grow" class:sel={picked.has(s.tracking_number)}>
                            <button class="cbx" class:on={picked.has(s.tracking_number)}
                                onclick={() => toggle(s.tracking_number)} aria-label="Select">
                                {picked.has(s.tracking_number) ? '✓' : ''}
                            </button>
                            <span class="gtrk"><Trk value={s.tracking_number} /></span>
                            <span class="gmeta">{stamp(s.scanned_at, r)} · {s.scanned_by || '—'}{s.times_scanned > 1 ? ` · ${s.times_scanned}×` : ''}</span>
                            <span class="gacts">
                                <button class="ab" disabled={busy} onclick={() => dismissOne(s.tracking_number)}>Dismiss</button>
                            </span>
                        </div>
                    {/each}
                </div>
            {/if}

            {#if junk.length}
                <button class="junk" onclick={() => showJunk = !showJunk}>
                    {showJunk ? '▾' : '▸'} {junk.length} scan{junk.length === 1 ? '' : 's'} that don't look like tracking numbers
                </button>
                {#if showJunk}
                    <div class="grp">
                        <div class="grph">
                            <button class="cbx" class:on={groupAll(junk)} onclick={() => toggleGroup(junk)} aria-label="Select all">
                                {groupAll(junk) ? '✓' : groupSome(junk) ? '–' : ''}
                            </button>
                            <h2>Probably not tracking numbers</h2>
                            <span class="cnt">{junk.length}</span>
                        </div>
                        <p class="why">Likely routing or sortation barcodes off the same label. Kept in case they matter.</p>
                        {#each junk as s}
                            <div class="grow" class:sel={picked.has(s.tracking_number)}>
                                <button class="cbx" class:on={picked.has(s.tracking_number)}
                                    onclick={() => toggle(s.tracking_number)} aria-label="Select">
                                    {picked.has(s.tracking_number) ? '✓' : ''}
                                </button>
                                <span class="gtrk dim">{s.tracking_number}</span>
                                <span class="gmeta">{stamp(s.scanned_at, r)} · {s.scanned_by || '—'}</span>
                                <span class="gacts">
                                    <button class="ab" disabled={busy} onclick={() => dismissOne(s.tracking_number)}>Dismiss</button>
                                </span>
                            </div>
                        {/each}
                    </div>
                {/if}
            {/if}
        {/if}

    <!-- ══════ settled ══════ -->
    {:else}
        {#if settled.length === 0}
            <div class="empty">
                <div class="empty-ic">▤</div>
                <h3>Nothing settled yet</h3>
                <p>Decisions you make here will be listed for the record.</p>
            </div>
        {:else}
            <div class="grp">
                <div class="grph" style="padding-left:12px">
                    <h2>Settled</h2><span class="cnt">{settled.length}</span>
                </div>
                {#each settled as p}
                    <div class="grow">
                        <span class="gtrk" style="margin-left:0"><Trk value={p.tracking_number} /></span>
                        <span class="gpo">{p.po_number || '—'}</span>
                        <span class="gmeta">{p.attention_by || '—'} · {stamp(p.attention_at, r)}{p.attention_note ? ` · ${p.attention_note}` : ''}</span>
                        <OrderIds ids={p.order_ids} compact />
                        <span class="mark {p.attention_state === 'resolved' ? 'ok' : p.attention_state === 'on_hold' ? 'hold' : 'bad'}">
                            {STATE_LABEL[p.attention_state]}
                        </span>
                        <span class="gacts">
                            <button class="ab" disabled={busy} onclick={() => reopen(p.tracking_number)}>Undo</button>
                        </span>
                    </div>
                {/each}
            </div>
        {/if}
    {/if}
</div>

<style>
    /* ── sticky bulk bar ── */
    .selbar{position:sticky;top:0;z-index:20;background:var(--ink);color:var(--paper);display:flex;align-items:center;gap:7px;padding:9px 12px;margin-bottom:12px;flex-wrap:wrap}
    .selbar .n{font-family:var(--data);font-size:12px;font-weight:600}
    .selbar .sp{flex:1}
    .sb{border:1.5px solid #45464D;background:transparent;color:var(--paper);font-family:var(--disp);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:6px 11px}
    .sb:disabled{opacity:.4}
    .sb.x{border-color:#8B3A36;color:#F4A6A2}
    .sb.h{border-color:#7A6220;color:#E8C877}
    .sb.v{border-color:#2F6E56;color:#79D3AC}
    .ninput{width:100%;margin:-6px 0 12px;border:1.5px solid var(--ink);padding:9px 11px;font-family:var(--data);font-size:14px;outline:none}

    /* ── group ── */
    .grp{border:1.5px solid var(--ink);background:#fff;margin-bottom:14px}
    .grph{display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--paper2);border-bottom:1.5px solid var(--ink)}
    .grph h2{font-family:var(--disp);font-size:11px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;flex:1}
    .cnt{font-family:var(--data);font-size:13px;font-weight:600}
    .why{font-family:var(--data);font-size:10px;color:var(--ink2);padding:7px 12px;border-bottom:1px solid var(--rule);line-height:1.7}

    /* ── checkbox ── */
    .cbx{width:16px;height:16px;border:1.5px solid var(--ink);background:#fff;display:grid;place-items:center;font-size:10px;line-height:1;color:#fff;flex-shrink:0;padding:0}
    .cbx.on{background:var(--ink)}
    .cbx.part{background:var(--ink3);color:#fff}

    /* ── row ── */
    .grow{display:flex;align-items:center;gap:9px;padding:6px 12px;border-bottom:1px solid var(--rule);font-family:var(--data);font-size:11px}
    .grow:last-child{border-bottom:none}
    .grow:hover{background:var(--paper2)}
    .grow.sel{background:#FDF3EC}
    .gtrk{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .gtrk.dim{color:var(--ink2)}
    .gpo{color:var(--ink2);font-size:10px;white-space:nowrap}
    .gmeta{color:var(--ink2);font-size:10px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .gacts{display:flex;gap:3px;flex-shrink:0}
    .ab{border:1.5px solid var(--rule);background:#fff;font-family:var(--disp);font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:4px 7px;color:var(--ink2);line-height:1}
    .ab:hover{border-color:var(--ink);color:var(--ink)}
    .ab.x:hover{border-color:var(--alert);color:var(--alert)}
    .ab.h:hover{border-color:var(--hold);color:var(--hold)}
    .ab.v:hover{border-color:var(--verify);color:var(--verify)}
    .ab:disabled{opacity:.4}

    .lnk{border:1.5px solid var(--ink);background:#fff;font-family:var(--disp);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:7px 12px;color:var(--ink)}
    .grp.quiet{opacity:.75}
    .junk{width:100%;margin-bottom:14px;border:1.5px dashed var(--rule);background:var(--paper2);padding:10px;font-family:var(--data);font-size:10px;color:var(--ink2);text-align:left}

    /* ── phone: stack the row, keep actions reachable ── */
    @media (max-width:768px){
        .grow{flex-wrap:wrap;gap:6px 8px;padding:9px 10px}
        .gtrk{flex:1;min-width:0}
        .gpo{order:3;width:100%;margin-left:25px}
        .gmeta{order:4;width:100%;margin-left:25px;flex:none}
        .gacts{order:5;width:100%;margin-left:25px;margin-top:2px}
        .ab{flex:1;text-align:center;padding:7px 4px}
        .selbar{gap:5px}
        .sb{flex:1;padding:8px 4px;text-align:center}
        .selbar .n{width:100%}
        .selbar .sp{display:none}
    }
</style>
