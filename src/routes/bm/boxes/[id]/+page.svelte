<script>
    import { onMount, tick } from 'svelte';
    import { page } from '$app/stores';
    import { role, who, showToast } from '$lib/stores.js';
    import { goto } from '$app/navigation';
    import * as api from '$lib/api.js';
    import { stamp, dayShort } from '$lib/time.js';

    let r = $state('none');
    let me = $state('');
    let boxId = $state('');

    let box = $state(null);
    let packed = $state([]);
    let loading = $state(true);
    let busy = $state(false);

    /* searching the pool */
    let q = $state('');
    let results = $state(null);
    let total = $state(0);
    let more = $state(false);
    let searching = $state(false);

    /* the line being added */
    let picking = $state(null);      // { row, qty, weight, reason }
    let qtyEl = $state(null);
    let wtEl = $state(null);

    /** Enter moves from quantity to weight, not straight to saving — the same
     *  stepping the Abhi packing table uses. */
    function onQtyKey(e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        wtEl?.focus();
        wtEl?.select();
    }

    let closing = $state(false);
    let deadWeight = $state('');
    let justAdded = $state('');

    role.subscribe(v => r = v);
    who.subscribe(v => me = v);
    page.subscribe(p => boxId = decodeURIComponent(p.params.id ?? ''));

    onMount(() => {
        load(true);
    });

    async function load(spinner = false) {
        if (spinner) loading = true;
        const out = await api.getBox(boxId);
        if (spinner) loading = false;
        if (!out.ok) { if (spinner) box = null; return; }
        box = out.data.box;
        packed = out.data.items;
    }

    /* ── search the pool ──
       Bombino opens the parcels, so there is nothing to scan. You look for
       the product itself, by name, ASIN or the barcode on the item. */
    async function search() {
        const term = q.trim();

        // With nothing typed this returned the entire pool — nine hundred lines
        // nobody asked for. The list appears when you look for something.
        if (term.length < 2) {
            results = null;
            return;
        }

        searching = true;
        picking = null;
        const out = await api.bmAvailable({ q: term, size: 30 });
        searching = false;
        if (!out.ok) { showToast(out.message || 'Search failed', 'err'); return; }
        results = out.data.rows;
        total = out.data.total;
        more = out.data.more;
    }

    async function loadMore() {
        const out = await api.bmAvailable({ q: q.trim(), from: results.length, size: 30 });
        if (!out.ok) return;
        results = [...results, ...out.data.rows];
        more = out.data.more;
    }

    let timer;
    function typed() { clearTimeout(timer); timer = setTimeout(search, 300); }

    async function pick(row) {
        picking = {
            row,
            qty: String(row.qty_left),
            weight: row.last_g != null ? '' : '',
            reason: ''
        };
        await tick();
        qtyEl?.focus();
        qtyEl?.select();
    }

    /* ── add it ── */
    async function add() {
        if (!picking) return;
        const qty = parseInt(picking.qty, 10);
        const w = parseFloat(picking.weight);

        if (!Number.isFinite(qty) || qty <= 0) { showToast('Quantity must be above zero', 'err'); return; }
        if (qty > picking.row.qty_left) { showToast(`Only ${picking.row.qty_left} left on that line`, 'err'); return; }
        if (!Number.isFinite(w) || w <= 0) { showToast('Enter a weight above zero', 'err'); return; }

        busy = true;
        const out = await api.bmAdd(boxId, picking.row.item_id, qty, w, picking.reason);
        busy = false;

        if (!out.ok) {
            showToast(out.reason === 'offline' ? 'Not saved — no connection' : 'Not saved', 'err');
            return;
        }
        if (!out.data?.ok) {
            showToast(out.data?.reason || 'Could not add', 'err');
            search();          // someone else may have taken it
            return;
        }

        const left = out.data.qty_left;
        showToast(left > 0
            ? `Added ${qty} · ${left} still left on that line`
            : `Added ${qty} · line complete`, 'ok');

        justAdded = picking.row.asin;
        setTimeout(() => { if (justAdded === picking?.row?.asin) justAdded = ''; }, 2000);

        picking = null;
        await Promise.all([load(), search()]);
    }

    async function removeRow(row) {
        busy = true;
        const out = await api.bmRemove(boxId, row.id);
        busy = false;
        if (!out.ok || !out.data?.ok) { showToast(out.data?.reason || 'Could not remove', 'err'); return; }
        showToast('Removed — back in the pool', 'ok');
        await Promise.all([load(), search()]);
    }

    /* ── totals ── */
    let units = $derived(packed.reduce((s, i) => s + (Number(i.qty_actual) || 0), 0));
    let grams = $derived(packed.reduce(
        (s, i) => s + (Number(i.weight_g) || 0) * (Number(i.qty_actual) || 0), 0));

    async function closeBox() {
        const w = parseFloat(deadWeight);
        if (!Number.isFinite(w) || w < 0) { showToast('Enter the empty box weight', 'err'); return; }
        busy = true;
        const out = await api.closeBox(boxId, w);
        busy = false;
        if (!out.ok) { showToast(out.status === 409 ? 'Already closed' : 'Could not close', 'err'); return; }
        showToast('Box closed', 'ok');
        closing = false;
        load();
    }

    /** Reopening a closed box lets a mistake be corrected without rebuilding
     *  it from scratch. The weights are kept; only the status goes back. */
    async function reopen() {
        if (!confirm(`Reopen ${boxId}?\n\nIt goes back to packing and can be changed again.`)) return;
        busy = true;
        const out = await api.reopenBox(boxId);
        busy = false;
        if (!out.ok) { showToast(out.message || 'Could not reopen', 'err'); return; }
        showToast('Box reopened', 'ok');
        load();
    }

    /** Deleting an open box hands its items back to the pool rather than
     *  stranding them as boxed with no box. */
    async function removeBox() {
        const n = packed.length;
        if (!confirm(`Delete ${boxId}?\n\n${n ? `Its ${n} line${n === 1 ? '' : 's'} go back to the pool.` : 'It is empty.'}`)) return;
        busy = true;
        const out = await api.bmDeleteBox(boxId);
        busy = false;
        if (!out.ok || !out.data?.ok) {
            showToast(out.data?.reason || 'Could not delete', 'err');
            return;
        }
        showToast('Box deleted, items released', 'ok');
        goto('/bm/boxes');
    }

    const kg = v => (v == null ? '—' : Number(v).toFixed(2) + ' kg');
    const when = ts => stamp(ts, r);
</script>

<header class="appbar">
    <div class="appbar-row">
        <div>
            <p class="eyebrow">
                Bombino · {box?.packer_name || '—'} · {box?.status === 'closed' ? 'closed' : 'packing'}
            </p>
            <h1>{boxId}</h1>
        </div>
        <div class="hacts">
            {#if box?.status === 'closed'}
                <button class="appbar-act" onclick={() => api.downloadBoxFile({ box: boxId })}>↓ Box file</button>
                <button class="appbar-act" disabled={busy} onclick={reopen}>Reopen</button>
            {:else if box}
                <button class="appbar-act danger" disabled={busy} onclick={removeBox}>Delete</button>
            {/if}
            <button class="appbar-act" onclick={() => goto('/bm/boxes')}>All boxes</button>
        </div>
    </div>
</header>

<div class="body">
    {#if loading}
        <div class="loading"><div class="spin"></div></div>
    {:else if !box}
        <div class="empty"><div class="empty-ic">▤</div><h3>Box not found</h3></div>
    {:else}
        <div class="band">
            <div class="c"><div class="k">Full</div><div class="v">{kg(box.filled_weight)}</div></div>
            <div class="c"><div class="k">Empty</div><div class="v">{kg(box.empty_weight)}</div></div>
            <div class="c net"><div class="k">Net</div>
                <div class="v">{box.empty_weight != null ? kg(box.net_weight) : '—'}</div></div>
            <div class="c"><div class="k">Lines</div><div class="v">{packed.length}</div></div>
            <div class="c"><div class="k">Items</div><div class="v">{units}</div></div>
            <div class="c"><div class="k">Contents</div><div class="v">{(grams/1000).toFixed(3)} kg</div></div>
        </div>

        {#if box.status === 'open'}
            <!-- ══ find an item ══ -->
            <div class="field" style="margin-top:14px">
                <label for="q">Find item</label>
                <input id="q" bind:value={q} oninput={typed}
                    placeholder="Item name, ASIN or barcode"
                    autocomplete="off" spellcheck="false"
                    onkeydown={(e) => e.key === 'Enter' && search()} />
                <button class="field-btn bm" onclick={search}>Search</button>
            </div>
            <p class="hint">
                Only Bombino items that have been delivered and are not already boxed.
                Click an ASIN to open the product on Amazon in a new tab.
            </p>

            {#if searching}
                <div class="loading"><div class="spin"></div></div>
            {:else if results}
                <div class="sec">
                    <h2>{total} available</h2>
                    <span>{results.length} shown</span>
                </div>
                {#if results.length === 0}
                    <div class="empty">
                        <div class="empty-ic">▤</div>
                        <h3>Nothing matches</h3>
                        <p>Either it has not been delivered yet, or it is already in a box.</p>
                    </div>
                {:else}
                    <div class="tblwrap">
                        <table class="tbl">
                            <thead><tr>
                                <th style="width:84px">Ordered</th><th style="width:100px">PO</th>
                                <th style="width:120px">ASIN</th><th>Item</th>
                                <th class="num" style="width:52px">Left</th>
                                <th style="width:1%"></th>
                            </tr></thead>
                            <tbody>
                                {#each results as row}
                                    <tr class:fresh={justAdded === row.asin}
                                        class:sel={picking?.row?.item_id === row.item_id}>
                                        <td class="mono">{row.order_date || '—'}</td>
                                        <td class="mono">{row.po_number || '—'}</td>
                                        <td>
                                            <a class="asin" href="https://www.amazon.com/dp/{row.asin}"
                                                target="_blank" rel="noopener noreferrer"
                                                onclick={(e) => e.stopPropagation()}>{row.asin} ↗</a>
                                        </td>
                                        <td class="ct" title={row.title}>
                                            {row.title}
                                            {#if row.elsewhere?.length}
                                                <span class="split">
                                                    {row.qty_boxed} already in {row.elsewhere.map(x => x.box_id).join(', ')}
                                                </span>
                                            {/if}
                                        </td>
                                        <td class="num mono">{row.qty_left}</td>
                                        <td><button class="pick" onclick={() => pick(row)}>Add</button></td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                    {#if more}
                        <button class="act ghost" style="margin-top:10px" onclick={loadMore}>
                            Show more — {total - results.length} left
                        </button>
                    {/if}
                {/if}
            {/if}

            <!-- ══ how many, and how heavy ══ -->
            {#if picking}
                <!-- Same shape as the Abhi packing table, so a packer moving
                     between the two streams is not learning a second screen. -->
                <div class="pbanner">
                    <span class="pt">{picking.row.asin}</span>
                    <span class="pp">{picking.row.po_number || 'No PO'}</span>
                    <span class="pn">{picking.row.qty_left} of {picking.row.qty_ordered} left</span>
                </div>

                <div class="tblwrap">
                    <table class="tbl">
                        <thead><tr>
                            <th>Item</th>
                            <th style="width:120px">ASIN</th>
                            <th class="num" style="width:70px">Left</th>
                            <th class="num" style="width:84px">Qty</th>
                            <th class="num" style="width:118px">Wt per unit (g)</th>
                            <th style="width:104px">Last time</th>
                        </tr></thead>
                        <tbody>
                            <tr>
                                <td class="ct" title={picking.row.title}>{picking.row.title}</td>
                                <td>
                                    <a class="asin" href="https://www.amazon.com/dp/{picking.row.asin}"
                                        target="_blank" rel="noopener noreferrer">{picking.row.asin} ↗</a>
                                </td>
                                <td class="num mono">{picking.row.qty_left}</td>
                                <td class="num">
                                    <input class="cellinp" bind:this={qtyEl} bind:value={picking.qty}
                                        type="number" inputmode="numeric" min="1"
                                        max={picking.row.qty_left}
                                        onkeydown={onQtyKey}
                                        onwheel={(e) => e.currentTarget.blur()} />
                                </td>
                                <td class="num">
                                    <input class="cellinp" bind:this={wtEl} bind:value={picking.weight}
                                        type="number" inputmode="decimal" step="0.01"
                                        placeholder={picking.row.last_g ?? '0'}
                                        onkeydown={(e) => e.key === 'Enter' && add()}
                                        onwheel={(e) => e.currentTarget.blur()} />
                                </td>
                                <td>
                                    {#if picking.row.last_g != null}
                                        <span class="lastw">{picking.row.last_g} g</span>
                                    {:else}
                                        <span class="muted">first time</span>
                                    {/if}
                                </td>
                            </tr>
                            {#if parseInt(picking.qty, 10) < picking.row.qty_left}
                                <tr class="reasonrow">
                                    <td colspan="6">
                                        <div class="reason">
                                            <span class="rlab">
                                                Taking {picking.qty || 0} of {picking.row.qty_left} —
                                                the rest stays available
                                            </span>
                                            <input class="rinput" bind:value={picking.reason}
                                                placeholder="Note, if useful"
                                                onkeydown={(e) => e.key === 'Enter' && add()} />
                                        </div>
                                    </td>
                                </tr>
                            {/if}
                        </tbody>
                    </table>
                </div>

                <div class="actbar">
                    <button class="act bm" disabled={busy} onclick={add}>
                        {busy ? 'Adding…' : '✓  Add to box'}
                    </button>
                    <button class="act ghost" onclick={() => picking = null}>Cancel</button>
                </div>
                <div class="note">
                    Weigh <b>one</b> unit, not the line. Tab moves across, Enter saves.
                </div>
            {/if}
        {/if}

        <!-- ══ in this box ══ -->
        <div class="sec">
            <h2>In this box</h2>
            <span>{packed.length} lines · {units} items · {(grams/1000).toFixed(3)} kg</span>
        </div>

        {#if packed.length === 0}
            <div class="empty">
                <div class="empty-ic">▤</div>
                <h3>Box is empty</h3>
                <p>Search for an item above to start filling it.</p>
            </div>
        {:else}
            <div class="tblwrap">
                <table class="tbl">
                    <thead><tr>
                        <th style="width:120px">ASIN</th><th>Item</th>
                        <th style="width:100px">PO</th>
                        <th class="num" style="width:52px">Qty</th>
                        <th class="num" style="width:76px">Wt/unit</th>
                        <th class="num" style="width:76px">Line</th>
                        {#if box.status === 'open'}<th style="width:1%"></th>{/if}
                    </tr></thead>
                    <tbody>
                        {#each packed as it}
                            <tr>
                                <td>
                                    <a class="asin" href="https://www.amazon.com/dp/{it.asin}"
                                        target="_blank" rel="noopener noreferrer">{it.asin} ↗</a>
                                </td>
                                <td class="ct" title={it.title}>
                                    {it.title}
                                    {#if it.qty_reason}<span class="rtag">{it.qty_reason}</span>{/if}
                                </td>
                                <td class="mono">{it.po_number || '—'}</td>
                                <td class="num mono">{it.qty_actual}</td>
                                <td class="num mono">{it.weight_g ?? '—'} g</td>
                                <td class="num mono">{it.weight_g != null ? (it.weight_g * it.qty_actual) : '—'} g</td>
                                {#if box.status === 'open'}
                                    <td>
                                        <button class="rm" disabled={busy} onclick={() => removeRow(it)}>Remove</button>
                                    </td>
                                {/if}
                            </tr>
                        {/each}
                    </tbody>
                    <tfoot><tr>
                        <td colspan="3">{packed.length} lines</td>
                        <td class="num">{units}</td><td></td>
                        <td class="num">{(grams/1000).toFixed(3)} kg</td>
                        {#if box.status === 'open'}<td></td>{/if}
                    </tr></tfoot>
                </table>
            </div>
        {/if}

        <!-- ══ close ══ -->
        {#if box.status === 'open' && packed.length > 0}
            {#if closing}
                <div class="lbl" style="margin-top:16px;max-width:520px">
                    <div class="lbl-top"><span class="lbl-carrier">Close this box</span></div>
                    <div style="padding:14px">
                        <div class="field">
                            <label for="dw">Empty wt</label>
                            <input id="dw" bind:value={deadWeight} type="number" step="0.01"
                                inputmode="decimal" placeholder="kg"
                                onwheel={(e) => e.currentTarget.blur()} />
                        </div>
                        <button class="act bm" style="width:100%" disabled={busy} onclick={closeBox}>
                            {busy ? 'Closing…' : 'Close box'}
                        </button>
                        <button class="act ghost" style="width:100%;margin-top:8px"
                            onclick={() => closing = false}>Not yet</button>
                    </div>
                </div>
            {:else}
                <button class="act dark" style="width:100%;margin-top:18px"
                    onclick={() => closing = true}>Close box</button>
            {/if}
        {/if}
    {/if}
</div>

<style>
    .hacts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
    .field-btn.bm{background:#2563A8;border-left-color:#2563A8}
    .act.bm{background:#2563A8}
    .hint{font-family:var(--data);font-size:10px;color:var(--ink2);margin:8px 0 4px;line-height:1.7}

    .band{display:flex;border:1.5px solid var(--ink);background:#fff;flex-wrap:wrap}
    .band .c{padding:9px 14px;border-right:1px solid var(--rule);min-width:88px}
    .band .c:last-child{border-right:none}
    .band .k{font-family:var(--data);font-size:8px;letter-spacing:.15em;text-transform:uppercase;color:var(--ink2)}
    .band .v{font-family:var(--data);font-size:15px;font-weight:600;margin-top:2px;white-space:nowrap}
    .band .c.net{background:var(--paper2)}
    .band .c.net .v{color:var(--verify)}

    .tblwrap{overflow-x:auto}
    .tbl{width:100%;border-collapse:collapse;background:#fff;border:1.5px solid var(--ink);min-width:680px}
    .tbl th{background:var(--ink);color:var(--paper);font-family:var(--disp);font-size:9.5px;
        font-weight:600;letter-spacing:.12em;text-transform:uppercase;text-align:left;padding:8px 10px;white-space:nowrap}
    .tbl td{padding:6px 10px;border-bottom:1px solid var(--rule);font-size:12px;vertical-align:middle}
    .tbl tbody tr:hover{background:#F3F7FC}
    .tbl tr.sel td{background:#EEF4FB}
    .tbl tr.fresh td{background:#F2FBF6;transition:background .8s ease}
    .tbl .num{text-align:right}
    .tbl .mono{font-family:var(--data);font-size:11px;color:var(--ink2)}
    .tbl tfoot td{border-top:1.5px solid var(--ink);background:var(--paper2);
        font-family:var(--data);font-size:11px;font-weight:600;padding:8px 10px}
    .ct{max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .asin{font-family:var(--data);font-size:10.5px;color:var(--signal);text-decoration:none;
        border-bottom:1px solid var(--signal);white-space:nowrap}
    .split{display:inline-block;font-family:var(--data);font-size:9px;background:#EEF4FB;
        color:#2563A8;border:1px solid #2563A8;padding:1px 6px;margin-left:6px}
    .rtag{display:inline-block;font-family:var(--data);font-size:9px;background:var(--paper3);
        color:var(--ink2);padding:1px 6px;margin-left:6px}
    .pick{border:1.5px solid #2563A8;background:#2563A8;color:#fff;font-family:var(--disp);
        font-size:9px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;padding:4px 10px;white-space:nowrap}
    .rm{border:1.5px solid var(--alert);background:#fff;color:var(--alert);font-family:var(--disp);
        font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:4px 9px}
    .rm:disabled{opacity:.4}

    .pbanner{display:flex;align-items:center;gap:11px;background:var(--ink);color:var(--paper);
        padding:9px 13px;margin-top:14px;flex-wrap:wrap}
    .pbanner .pt{font-family:var(--data);font-size:13px;font-weight:600}
    .pbanner .pp{font-family:var(--data);font-size:10px;color:#9A9CA4}
    .pbanner .pn{margin-left:auto;font-family:var(--data);font-size:10px;color:#9A9CA4}
    .cellinp{width:100%;border:1.5px solid var(--ink);padding:6px 8px;font-family:var(--data);
        font-size:15px;text-align:right;background:#fff;outline:none}
    .cellinp:focus{box-shadow:inset 0 0 0 2px #2563A8;background:#FAFCFF}
    .lastw{font-family:var(--data);font-size:11px;font-weight:600;color:var(--verify)}
    .muted{font-family:var(--data);font-size:10.5px;color:var(--ink3)}
    .reasonrow td{background:#EEF4FB;padding:8px 10px}
    .reason{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .rlab{font-family:var(--data);font-size:10px;color:#2563A8;font-weight:600;white-space:nowrap}
    .rinput{flex:1;min-width:180px;border:1.5px solid #2563A8;padding:6px 9px;
        font-family:var(--body);font-size:13px;outline:none;background:#fff}
    .actbar{display:flex;gap:8px;margin-top:12px;max-width:560px}
    .actbar .act{margin-top:0;width:auto}
    .actbar .act:not(.ghost){flex:1}
    .actbar .act.ghost{flex:0 0 auto;padding:13px 24px}
    .appbar-act.danger{border-color:var(--alert);color:var(--alert)}
    .appbar-act.danger:hover{background:var(--alert);color:#fff}

</style>
