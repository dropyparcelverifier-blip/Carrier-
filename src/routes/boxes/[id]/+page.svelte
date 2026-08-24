<script>
    import { onMount, onDestroy, tick } from 'svelte';
    import { page } from '$app/stores';
    import { role, who, showToast } from '$lib/stores.js';
    import { goto } from '$app/navigation';
    import Bars from '$lib/Bars.svelte';
    import Trk from '$lib/Trk.svelte';
    import * as api from '$lib/api.js';
    import { stamp } from '$lib/time.js';
    import OrderIds from '$lib/OrderIds.svelte';

    let r = $state('none');
    let me = $state('');
    let boxId = $state('');

    let box = $state(null);
    let packed = $state([]);
    let loading = $state(true);

    let mode = $state('key');
    let keyed = $state('');
    let scanner = null;
    let live = $state(false);

    let current = $state(null);   // { parcel, items }
    let results = $state(null);   // candidates to choose from
    let forcing = $state(false);  // this parcel was never scanned at Jamaica
    let busy = $state(false);
    let closing = $state(false);
    let deadWeight = $state('');
    let justAdded = $state('');   // highlights the row that just landed

    // Elements we move focus between, so the loop never needs the mouse
    let scanEl = $state(null);


    role.subscribe(v => r = v);
    who.subscribe(v => me = v);
    page.subscribe(p => boxId = decodeURIComponent(p.params.id ?? ''));

    onMount(() => {
        load(true);
    });

    onDestroy(() => stopCam());

    /** `spinner` is false for background refreshes — blanking the screen
     *  after every action was the flicker that made this feel like a reload. */
    async function load(spinner = false) {
        if (spinner) loading = true;
        const out = await api.getBox(boxId);
        if (spinner) loading = false;
        if (!out.ok) { if (spinner) box = null; return; }
        box = out.data.box;
        packed = out.data.items;
    }

    /* ── grouped view of what's in the box ── */
    let groups = $derived.by(() => {
        const m = new Map();
        for (const it of packed) {
            if (!m.has(it.tracking_number)) m.set(it.tracking_number, []);
            m.get(it.tracking_number).push(it);
        }
        return Array.from(m, ([tracking, items]) => ({ tracking, items }));
    });
    // weight_g is the weight of ONE unit, so a line weighs qty × weight
    let totalWeight = $derived(packed.reduce(
        (s, i) => s + (Number(i.weight_g) || 0) * (Number(i.qty_actual) || 0), 0));
    let totalQty = $derived(packed.reduce((s, i) => s + (Number(i.qty_actual) || 0), 0));


    async function focusScan() {
        await tick();
        scanEl?.focus();
    }
    /** Every weight cell is registered by row, so Enter can step between them.
     *  `bind:this` can't take an index expression, so an action does the job. */
    let weightEls = $state([]);

    function weightCell(node, i) {
        weightEls[i] = node;
        return {
            update(n) { weightEls[n] = node; },
            destroy() { weightEls = weightEls.filter(x => x !== node); }
        };
    }

    /** First weight cell of the open parcel — where the packer always starts. */
    async function focusWeight() {
        await tick();
        weightEls[0]?.focus();
        weightEls[0]?.select();
    }

    /* ── camera ── */
    async function startCam() {
        mode = 'cam'; live = true;
        try {
            const { Html5Qrcode } = await import('html5-qrcode');
            await new Promise(r => setTimeout(r, 120));
            scanner = new Html5Qrcode('boxcam');
            await scanner.start({ facingMode: 'environment' },
                { fps: 10, qrbox: { width: 300, height: 130 } },
                async (txt) => { await stopCam(); await search(txt.trim()); }, () => {});
        } catch {
            showToast('Camera unavailable — key it in', 'err');
            live = false; mode = 'key'; focusScan();
        }
    }
    async function stopCam() {
        if (scanner) { try { await scanner.stop(); } catch {} scanner = null; }
        live = false;
    }

    /* ── open a parcel ── */
    /* ── search, then choose ──
       A PO can cover several parcels and a partial tracking number can match
       more than one. Picking silently is how the wrong parcel ends up in a box,
       so the list is always shown. */
    async function search(input) {
        const term = String(input || '').trim();
        if (!term) return;
        busy = true;
        current = null;
        results = null;

        const out = await api.searchForBox(boxId, term);
        busy = false;

        if (!out.ok) {
            showToast(out.reason === 'offline' ? 'No connection — try again' : 'Search failed', 'err');
            return;
        }

        // A scanned barcode is one parcel — open it rather than asking which
        if (out.data.exact) {
            await choose({ tracking_number: out.data.exact, selectable: true });
            return;
        }

        if (!out.data.rows.length) {
            showToast('Nothing matches that', 'err');
            focusScan();
            return;
        }

        results = out.data.rows;
    }

    /* ── open the chosen parcel ── */
    async function choose(row) {
        if (!row.selectable) return;
        busy = true;

        const out = await api.pullParcel(boxId, row.tracking_number);
        busy = false;

        if (!out.ok) {
            showToast(out.reason === 'offline' ? 'No connection — try again' : 'Could not open that', 'err');
            return;
        }

        const res = out.data;
        if (!res.ok) {
            showToast({
                not_found: 'Not on the manifest',
                not_received: 'Not received at Jamaica yet',
                taken: `Already packed in ${res.box_id ?? 'another box'}`
            }[res.reason] ?? 'Cannot pack that one', 'err');
            return;
        }

        const rows = (res.items.length ? res.items : [{
            asin: '', title: '(no item detail on file)', po_number: res.parcel.po_number,
            quantity: res.parcel.item_count, unit_price: null, item_total: null
        }]).map(it => ({
            asin: it.asin || '',
            title: it.title || '',
            po_number: it.po_number || res.parcel.po_number || '',
            qty_expected: it.quantity ?? 1,
            qty_actual: String(it.quantity ?? 1),
            qty_reason: '',
            weight_g: '',
            last_g: it.last_g ?? null,
            last_at: it.last_at ?? null,
            unit_price: it.unit_price,
            item_total: it.item_total
        }));

        current = { parcel: res.parcel, items: rows };
        forcing = res.needsForce === true;
        results = null;
        keyed = '';
        focusWeight();
    }

    /* ── validation ──
       The scale sits on the packing table, so a blank weight is an omission
       rather than a limitation. Zero is refused for the same reason. */
    function problem() {
        for (const [i, it] of current.items.entries()) {
            const q = parseInt(it.qty_actual, 10);
            if (!Number.isFinite(q) || q < 0) return { row: i, msg: `Row ${i + 1}: check the quantity` };

            const w = parseFloat(it.weight_g);
            if (it.weight_g === '' || !Number.isFinite(w) || w <= 0) {
                return { row: i, msg: `Row ${i + 1}: enter a weight above zero` };
            }
            if (q !== it.qty_expected && !String(it.qty_reason ?? '').trim()) {
                return { row: i, msg: `Row ${i + 1}: say why the quantity differs` };
            }
        }
        return null;
    }

    /** Enter moves to the next weight, and only saves from the last row.
     *  Pressing it on row one used to submit the whole parcel, taking every
     *  later weight with it as blank. */
    async function onKey(e, i) {
        if (e.key !== 'Enter') return;
        e.preventDefault();

        const it = current.items[i];
        const w = parseFloat(it.weight_g);
        if (it.weight_g === '' || !Number.isFinite(w) || w <= 0) {
            showToast('Enter a weight above zero', 'err');
            return;
        }
        if (parseInt(it.qty_actual, 10) !== it.qty_expected && !String(it.qty_reason ?? '').trim()) {
            showToast('Say why the quantity differs', 'err');
            return;
        }

        if (i < current.items.length - 1) {
            await tick();
            weightEls[i + 1]?.focus();
            weightEls[i + 1]?.select();
        } else {
            save();
        }
    }

    /* ── save the whole parcel ── */
    async function save() {
        if (!current) return;
        const bad = problem();
        if (bad) {
            showToast(bad.msg, 'err');
            await tick();
            weightEls[bad.row]?.focus();
            return;
        }
        busy = true;

        const tracking = current.parcel.tracking_number;
        const out = await api.addToBox(boxId, tracking, current.items, forcing);
        busy = false;

        if (!out.ok) {
            showToast(out.reason === 'offline' ? 'Not saved — no connection' : 'Not saved', 'err');
            return;
        }
        if (!out.data?.ok) {
            showToast({
                taken: `Already packed in ${out.data.box_id ?? 'another box'}`,
                not_received: 'Not received at Jamaica yet',
                not_found: 'Not on the manifest'
            }[out.data.reason] ?? 'Not saved', 'err');
            return;
        }

        // Append locally so the list grows without the page blanking
        packed = [
            ...current.items.map(it => ({
                box_id: boxId,
                tracking_number: tracking,
                asin: it.asin,
                title: it.title,
                po_number: it.po_number,
                qty_expected: it.qty_expected,
                qty_actual: parseInt(it.qty_actual, 10) || 0,
                weight_g: it.weight_g === '' ? null : parseFloat(it.weight_g),
                packed_by: me,
                packed_at: new Date().toISOString()
            })),
            ...packed
        ];

        justAdded = tracking;
        setTimeout(() => { if (justAdded === tracking) justAdded = ''; }, 2000);

        showToast(forcing
            ? `Added and marked received · ${groups.length + 1} parcels in box`
            : `Added · ${groups.length + 1} parcels in box`, 'ok');
        current = null;
        forcing = false;

        if (mode === 'cam') startCam(); else focusScan();
        load();   // quiet reconcile in the background
    }

    /* ── correcting a weight ──
       A wrong weight used to mean removing the whole parcel and adding it
       again. Click the number, type, Enter. */
    let editing = $state(null);      // { rowId, value }

    function startEdit(it) {
        if (box?.status !== 'open') return;
        editing = { rowId: it.id, value: String(it.weight_g ?? '') };
    }

    async function saveEdit() {
        // Enter saves and clears the edit, then the field loses focus and
        // blur fires a second time against nothing. Guarding on entry means
        // the second call is a no-op instead of an error.
        if (!editing || busy) return;

        const w = parseFloat(editing.value);
        if (!Number.isFinite(w) || w <= 0) { showToast('Weight must be above zero', 'err'); return; }

        const rowId = editing.rowId;
        busy = true;
        const out = await api.setRowWeight(boxId, rowId, w);
        busy = false;

        if (!out.ok) {
            showToast(out.status === 409 ? 'That box is closed' : 'Not saved', 'err');
            return;
        }
        showToast('Weight updated', 'ok');
        editing = null;
        load();
    }

    function skip() {
        current = null;
        results = null;
        forcing = false;
        if (mode === 'cam') startCam(); else focusScan();
    }

    async function removeParcel(tracking) {
        busy = true;
        const out = await api.removeFromBox(boxId, tracking);
        busy = false;
        if (!out.ok) { showToast('Could not remove — try again', 'err'); return; }
        // Drop it locally rather than refetching everything
        packed = packed.filter(i => i.tracking_number !== tracking);
        showToast('Removed', 'ok');
        load();
    }

    /* ── close ── */
    async function closeBox() {
        const w = parseFloat(deadWeight);
        if (!Number.isFinite(w) || w < 0) { showToast('Enter the empty box weight', 'err'); return; }
        busy = true;
        const out = await api.closeBox(boxId, w);
        busy = false;
        if (!out.ok) {
            showToast(out.status === 409 ? 'That box is already closed'
                    : out.reason === 'offline' ? 'No connection' : 'Could not close the box', 'err');
            return;
        }
        showToast('Box closed', 'ok');
        closing = false;
        load();
    }

    async function reopen() {
        const out = await api.reopenBox(boxId);
        if (!out.ok) { showToast('Could not reopen', 'err'); return; }
        showToast('Box reopened', 'ok');
        load();
    }

    /* ── box file ──
       Same endpoint and same columns as the daily file; only the scope
       differs. Keeping a second, hand-built CSV here is what let a
       different shape reach the forwarder. */
    function downloadFile() {
        api.downloadBoxFile({ box: boxId });
    }

    const when = ts => stamp(ts, r);
    const kg = v => (v == null ? '—' : Number(v).toFixed(2) + ' kg');
</script>

<header class="appbar">
    <div class="appbar-row">
        <div>
            <p class="eyebrow">
                {box?.packer_name || '—'}
                {#if box?.status === 'closed'} · closed {when(box.closed_at)}{:else} · packing{/if}
            </p>
            <h1>{boxId}</h1>
        </div>
        <div class="hacts">
            {#if box?.status === 'closed'}
                <button class="appbar-act" onclick={downloadFile}>↓ Box file</button>
                {#if r === 'admin'}
                    <button class="appbar-act" onclick={reopen}>Reopen</button>
                {/if}
            {/if}
            <button class="appbar-act" onclick={() => goto('/boxes')}>All boxes</button>
        </div>
    </div>
</header>

<div class="body">
    {#if loading}
        <div class="loading"><div class="spin"></div></div>
    {:else if !box}
        <div class="empty">
            <div class="empty-ic">▤</div>
            <h3>Box not found</h3>
            <p>No box with that number.</p>
        </div>
    {:else}
        {#if box.status === 'closed'}
            <!-- A closed box is a record, not a workspace: every fact on one
                 line, and nothing repeated underneath the table. -->
            <div class="band">
                <div class="bcell"><div class="k">Full</div><div class="v">{kg(box.filled_weight)}</div></div>
                <div class="bcell"><div class="k">Empty</div><div class="v">{kg(box.empty_weight)}</div></div>
                <div class="bcell net"><div class="k">Net</div><div class="v">{kg(box.net_weight)}</div></div>
                <div class="bcell"><div class="k">Parcels</div><div class="v">{groups.length}</div></div>
                <div class="bcell"><div class="k">Items</div><div class="v">{totalQty}</div></div>
                <div class="bcell"><div class="k">Contents</div><div class="v">{(totalWeight/1000).toFixed(3)} kg</div></div>
                <div class="bcell"><div class="k">Packer</div><div class="v">{box.packer_name || '—'}</div></div>
                <div class="bcell"><div class="k">Closed by</div><div class="v">{box.closed_by || '—'}</div></div>
                <div class="bcell grow"></div>
            </div>
        {:else}
            <div class="stats" style="grid-template-columns:repeat(3,1fr)">
                <div class="stat"><div class="k">Full</div><div class="v" style="font-size:19px">{kg(box.filled_weight)}</div></div>
                <div class="stat"><div class="k">Empty</div><div class="v" style="font-size:19px">{kg(box.empty_weight)}</div></div>
                <div class="stat"><div class="k">Net</div><div class="v v-ok" style="font-size:19px">{box.empty_weight != null ? kg(box.net_weight) : '—'}</div></div>
            </div>
        {/if}

        {#if box.status === 'open'}
            <!-- ══ scan ══ -->
            {#if !current}
                <div class="chips">
                    <button class="chip" class:on={mode==='cam'} onclick={startCam}>Camera</button>
                    <button class="chip" class:on={mode==='key'} onclick={() => { mode='key'; stopCam(); focusScan(); }}>Key in</button>
                </div>

                {#if mode === 'cam'}
                    <div class="view" style="margin-top:10px">
                        <div class="reg tl"></div><div class="reg tr"></div>
                        <div class="reg bl"></div><div class="reg br"></div>
                        {#if live}
                            <div class="sweep"></div><div id="boxcam" class="camhost"></div>
                        {:else}
                            <p class="view-hint">Camera off</p>
                        {/if}
                    </div>
                    {#if !live}<button class="act" onclick={startCam}>Start camera</button>{/if}
                {:else}
                    <div class="field" style="margin-top:10px">
                        <label for="tk">Scan</label>
                        <!-- svelte-ignore a11y_autofocus -->
                        <input id="tk" bind:this={scanEl} bind:value={keyed}
                            placeholder="Tracking number or PO" autofocus
                            autocomplete="off" autocapitalize="characters" spellcheck="false"
                            onkeydown={(e) => e.key === 'Enter' && search(keyed)} />
                        <button class="field-btn" onclick={() => search(keyed)}>Search</button>
                    </div>
                {/if}

                {#if busy}<div class="loading"><div class="spin"></div></div>{/if}

                {#if results}
                    <div class="sec"><h2>Choose a parcel</h2><span>{results.length} match{results.length === 1 ? '' : 'es'}</span></div>
                    <div class="reslist">
                        {#each results as row}
                            <button class="res" class:off={!row.selectable}
                                disabled={!row.selectable}
                                onclick={() => choose(row)}>
                                <span class="rtrk">{row.tracking_number}</span>
                                <span class="rpo">{row.po_number || '—'}</span>
                                <span class="rmeta">{row.carrier || '—'} · {row.item_count} pcs · {row.shipment_date || '—'}</span>
                                <span class="mark {row.state === 'ready' ? 'ok' : row.state === 'not_received' ? 'bad' : 'hold'}">{row.why}</span>
                                {#if row.selectable && row.state === 'not_received'}
                                    <span class="vouch">Add anyway</span>
                                {/if}
                            </button>
                        {/each}
                    </div>
                    <div class="note">
                        {#if r === 'admin'}
                            A parcel the cargo team never scanned can still be added — it is
                            in front of you, so it plainly arrived. Adding it records that
                            receipt as well.
                        {:else}
                            Only parcels scanned in at Jamaica can be packed. If one is in
                            your hands but greyed out here, ask the office to add it.
                        {/if}
                    </div>
                {/if}

            <!-- ══ one item at a time ══ -->
            {:else}
                <div class="pbanner">
                    <span class="pt">{current.parcel.tracking_number}</span>
                    <span class="pp">{current.parcel.po_number || 'No PO'}</span>
                    <OrderIds ids={current.parcel.order_ids} compact />
                    <span class="pn">{current.items.length} item{current.items.length === 1 ? '' : 's'}</span>
                </div>

                {#if forcing}
                    <div class="vouchbar">
                        <b>Never scanned at Jamaica.</b>
                        Adding this will also mark it received, recorded against your name.
                    </div>
                {/if}

                <div class="tbl-wrap">
                    <table class="ptbl">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th style="width:110px">ASIN</th>
                                <th class="num" style="width:74px">Expected</th>
                                <th class="num" style="width:80px">Qty</th>
                                <th class="num" style="width:112px">Wt per unit (g)</th>
                                <th style="width:110px">Last time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each current.items as it, i}
                                <tr>
                                    <td class="cell-title" title={it.title}>{it.title}</td>
                                    <td>
                                        {#if it.asin}
                                            <a href="https://www.amazon.com/dp/{it.asin}" target="_blank" rel="noopener noreferrer">{it.asin} ↗</a>
                                        {:else}
                                            <span class="muted">—</span>
                                        {/if}
                                    </td>
                                    <td class="num muted">{it.qty_expected}</td>
                                    <td class="num">
                                        <input class="cellinp" bind:value={it.qty_actual}
                                            type="number" inputmode="numeric" min="0"
                                            onkeydown={(e) => onKey(e, i)} onwheel={(e) => e.currentTarget.blur()} />
                                    </td>
                                    <td class="num">
                                        <input class="cellinp"
                                            use:weightCell={i}
                                            bind:value={it.weight_g}
                                            type="number" inputmode="decimal" step="0.01"
                                            placeholder={it.last_g ?? '0'}
                                            onkeydown={(e) => onKey(e, i)}
                                            onwheel={(e) => e.currentTarget.blur()} />
                                    </td>
                                    <td>
                                        {#if it.last_g != null}
                                            <span class="lastw">{it.last_g} g</span>
                                        {:else}
                                            <span class="muted">first time</span>
                                        {/if}
                                    </td>
                                </tr>
                                {#if parseInt(it.qty_actual, 10) !== it.qty_expected}
                                    <tr class="reasonrow">
                                        <td colspan="6">
                                            <div class="reason">
                                                <span class="rlab">
                                                    Quantity changed from {it.qty_expected} to {it.qty_actual || 0} — why?
                                                </span>
                                                <input class="rinput" bind:value={it.qty_reason}
                                                    placeholder="e.g. one arrived damaged"
                                                    onkeydown={(e) => onKey(e, i)} />
                                            </div>
                                        </td>
                                    </tr>
                                {/if}
                            {/each}
                        </tbody>
                    </table>
                </div>

                <div class="actbar">
                    <button class="act" onclick={save} disabled={busy}>
                        {busy ? 'Saving…' : forcing ? '✓  Add and mark received' : '✓  Add to box'}
                    </button>
                    <button class="act ghost" onclick={skip}>Skip</button>
                </div>
                <div class="note">
                    Weigh <b>one</b> unit, not the whole line — a quantity of 12 at 681 g is
                    entered as 681. Quantity comes from the report; change it only if the
                    parcel disagrees. Tab moves across, Enter saves and returns focus to Scan.
                </div>
            {/if}
        {/if}

        <!-- ══ in this box ══ -->
        <div class="sec">
            <h2>In this box</h2>
            <span>{groups.length} parcel{groups.length === 1 ? '' : 's'} · {totalQty} item{totalQty === 1 ? '' : 's'} · {(totalWeight/1000).toFixed(3)} kg</span>
        </div>

        {#if groups.length === 0}
            <div class="empty">
                <div class="empty-ic">▤</div>
                <h3>Box is empty</h3>
                <p>Scan a parcel's tracking number to start filling it.</p>
            </div>
        {:else}
            <div class="tbl-wrap">
                <table class="ptbl packedtbl">
                    <thead>
                        <tr>
                            <th style="width:150px">Tracking</th>
                            <th style="width:96px">PO</th>
                            <th style="width:112px">ASIN</th>
                            <th>Item</th>
                            <th class="num" style="width:52px">Qty</th>
                            <th class="num" style="width:74px">Wt/unit</th>
                            <th class="num" style="width:74px">Line</th>
                            {#if box.status === 'open'}<th style="width:1%"></th>{/if}
                        </tr>
                    </thead>
                    <tbody>
                        {#each groups as g}
                            {#each g.items as it, i}
                                <tr class:groupstart={i === 0} class:fresh={justAdded === g.tracking}>
                                    <td>
                                        {#if i === 0}<Trk value={g.tracking} />{/if}
                                    </td>
                                    <td class="muted">{i === 0 ? (it.po_number || '—') : ''}</td>
                                    <td>
                                        {#if it.asin}
                                            <a href="https://www.amazon.com/dp/{it.asin}" target="_blank" rel="noopener noreferrer">{it.asin} ↗</a>
                                        {:else}
                                            <span class="muted">—</span>
                                        {/if}
                                    </td>
                                    <td class="cell-title" title={it.title}>
                                        {it.title}
                                        {#if it.qty_reason}
                                            <span class="rtag" title={it.qty_reason}>{it.qty_reason}</span>
                                        {/if}
                                    </td>
                                    <td class="num">{it.qty_actual}</td>
                                    <td class="num">
                                        {#if editing?.rowId === it.id}
                                            <!-- svelte-ignore a11y_autofocus -->
                                            <input class="wedit" bind:value={editing.value}
                                                type="number" inputmode="decimal" step="0.01" autofocus
                                                onkeydown={(e) => {
                                                    if (e.key === 'Enter') saveEdit();
                                                    if (e.key === 'Escape') editing = null;
                                                }}
                                                onblur={() => { if (editing) saveEdit(); }}
                                                onwheel={(e) => e.currentTarget.blur()} />
                                        {:else if box.status === 'open'}
                                            <button class="wcell" onclick={() => startEdit(it)}
                                                title="Click to correct">
                                                {it.weight_g != null ? it.weight_g + ' g' : '—'}
                                            </button>
                                        {:else}
                                            {it.weight_g != null ? it.weight_g + ' g' : '—'}
                                        {/if}
                                    </td>
                                    <td class="num">{it.weight_g != null ? (it.weight_g * (it.qty_actual || 0)) + ' g' : '—'}</td>
                                    {#if box.status === 'open'}
                                        <td>
                                            {#if i === 0}
                                                <button class="rm" onclick={() => removeParcel(g.tracking)} disabled={busy}>Remove</button>
                                            {/if}
                                        </td>
                                    {/if}
                                </tr>
                            {/each}
                        {/each}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4">{groups.length} parcel{groups.length === 1 ? '' : 's'}</td>
                            <td class="num">{totalQty}</td>
                            <td></td>
                            <td class="num">{(totalWeight/1000).toFixed(3)} kg</td>
                            {#if box.status === 'open'}<td></td>{/if}
                        </tr>
                    </tfoot>
                </table>
            </div>
        {/if}

        <!-- ══ close ══ -->
        {#if box.status === 'open'}
            {#if closing}
                <div class="lbl" style="margin-top:16px">
                    <div class="lbl-top"><span class="lbl-carrier">Close this box</span></div>
                    <div style="padding:14px">
                        <div class="field">
                            <label for="dw">Empty wt</label>
                            <input id="dw" bind:value={deadWeight} type="number" step="0.01" inputmode="decimal" placeholder="kg" />
                        </div>
                        <button class="act" style="width:100%" onclick={closeBox} disabled={busy}>
                            {busy ? 'Closing…' : 'Close box'}
                        </button>
                        <button class="act ghost" style="width:100%;margin-top:8px" onclick={() => closing = false}>Not yet</button>
                        <div class="note">Empty weight is the box and packing material on their own. Net is worked out from it.</div>
                    </div>
                </div>
            {:else if groups.length > 0}
                <button class="act dark" style="width:100%;margin-top:18px" onclick={() => closing = true}>Close box</button>
            {/if}
        {/if}
    {/if}
</div>

<style>
    :global(#boxcam){border:none !important}
    :global(#qr-shaded-region){display:none !important}

    /* header actions */
    .hacts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}

    /* closed box: one band, nothing repeated below the table */
    .band{display:flex;align-items:stretch;border:1.5px solid var(--ink);background:#fff;flex-wrap:wrap}
    .bcell{padding:9px 14px;border-right:1px solid var(--rule);min-width:92px}
    .bcell:last-child{border-right:none}
    .bcell .k{font-family:var(--data);font-size:8px;letter-spacing:.15em;text-transform:uppercase;color:var(--ink2)}
    .bcell .v{font-family:var(--data);font-size:15px;font-weight:600;margin-top:2px;white-space:nowrap}
    .bcell.net{background:var(--paper2)}
    .bcell.net .v{color:var(--verify)}
    .bcell.grow{flex:1;border-right:none;min-width:0}
    @media (max-width:700px){
        .bcell{flex:1 1 33%;min-width:0;border-bottom:1px solid var(--rule)}
        .bcell.grow{display:none}
    }

    /* candidates */
    .reslist{border:1.5px solid var(--ink);background:#fff}
    .res{width:100%;display:flex;align-items:center;gap:10px;padding:9px 12px;background:#fff;
        border:none;border-bottom:1px solid var(--rule);text-align:left;font-family:var(--data);font-size:11px}
    .res:last-child{border-bottom:none}
    .res:hover:not(.off){background:var(--paper2)}
    .res.off{opacity:.5;cursor:not-allowed}
    .rtrk{font-weight:600;min-width:150px}
    .rpo{color:var(--ink2);font-size:10px;min-width:90px}
    .rmeta{color:var(--ink2);font-size:10px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .vouch{font-family:var(--disp);font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
        background:var(--signal);color:#fff;padding:3px 7px;white-space:nowrap}
    .vouchbar{background:#fff;border:1.5px solid var(--signal);border-left-width:4px;padding:9px 12px;
        font-family:var(--data);font-size:10px;color:var(--ink2);line-height:1.7}
    .vouchbar b{color:var(--signal);font-family:var(--body);font-weight:600}

    /* parcel banner */
    .pbanner{display:flex;align-items:center;gap:11px;background:var(--ink);color:var(--paper);padding:9px 13px;margin-top:14px;flex-wrap:wrap}
    .pt{font-family:var(--data);font-size:13px;font-weight:600}
    .pp{font-family:var(--data);font-size:10px;color:#9A9CA4}
    .pn{margin-left:auto;font-family:var(--data);font-size:10px;color:#9A9CA4}

    /* last-time hint and the reason field */
    .lastw{font-family:var(--data);font-size:11px;font-weight:600;color:var(--verify)}
    .muted{font-family:var(--data);font-size:10.5px;color:var(--ink3)}
    .reasonrow td{background:#FDF3EC;border-bottom:1px solid var(--rule);padding:8px 10px}
    .reason{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .rlab{font-family:var(--data);font-size:10px;color:var(--signal);font-weight:600;white-space:nowrap}
    .rinput{flex:1;min-width:200px;border:1.5px solid var(--signal);padding:6px 9px;
        font-family:var(--body);font-size:13px;outline:none;background:#fff}
    .rtag{display:inline-block;font-family:var(--data);font-size:9px;background:var(--paper3);
        color:var(--ink2);padding:1px 6px;margin-left:6px;vertical-align:middle}

    /* tables */
    .ptbl{width:100%;border-collapse:collapse;background:#fff;border:1.5px solid var(--ink);border-top:none}
    .packedtbl{border-top:1.5px solid var(--ink)}
    .ptbl th{background:var(--paper2);font-family:var(--disp);font-size:9.5px;font-weight:600;letter-spacing:.13em;
        text-transform:uppercase;text-align:left;padding:7px 10px;border-bottom:1.5px solid var(--ink);white-space:nowrap}
    .ptbl td{padding:5px 10px;border-bottom:1px solid var(--rule);font-size:12px;vertical-align:middle}
    .ptbl tbody tr:last-child td{border-bottom:none}
    .ptbl .num{text-align:right}
    .ptbl .muted{color:var(--ink2);font-family:var(--data);font-size:11px}
    .ptbl a{font-family:var(--data);font-size:10.5px;color:var(--signal);text-decoration:none;border-bottom:1px solid var(--signal);white-space:nowrap}
    .cell-title{max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ptbl tfoot td{border-top:1.5px solid var(--ink);background:var(--paper2);font-family:var(--data);
        font-size:11px;font-weight:600;padding:8px 10px}

    /* a second parcel starts a new block */
    .packedtbl tr.groupstart td{border-top:1px solid var(--ink3)}
    .packedtbl tbody tr:first-child td{border-top:none}
    .packedtbl tr.fresh td{background:#F2FBF6;transition:background .8s ease}

    /* a weight you can correct in place */
    .wcell{border:1px dashed var(--rule);background:none;font-family:var(--data);font-size:12px;
        color:var(--ink);padding:2px 6px;width:100%;text-align:right}
    .wcell:hover{border-color:var(--signal);color:var(--signal);background:#FDF3EC}
    .wedit{width:100%;border:1.5px solid var(--signal);padding:4px 6px;font-family:var(--data);
        font-size:13px;text-align:right;outline:none;background:#FFFCF7}

    .cellinp{width:100%;border:1.5px solid var(--ink);padding:6px 8px;font-family:var(--data);
        font-size:15px;outline:none;text-align:right;background:#fff}
    .cellinp:focus{box-shadow:inset 0 0 0 2px var(--signal);background:#FFFCF7}

    .rm{border:1.5px solid var(--alert);background:#fff;color:var(--alert);font-family:var(--disp);
        font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:4px 8px;white-space:nowrap}
    .rm:disabled{opacity:.4}

    /* .act is width:100% globally, which fought the flex sizing and left the
       primary button squeezed into a column. Width is handed to flex here. */
    .actbar{display:flex;gap:8px;margin-top:12px;align-items:stretch}
    .actbar .act{width:auto;margin-top:0;white-space:nowrap}
    .actbar .act:not(.ghost){flex:1 1 auto}
    .actbar .act.ghost{flex:0 0 auto;padding:13px 26px}

    /* narrow screens: let the table scroll rather than crush the columns */
    @media (max-width:700px){
        .tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
        .ptbl{min-width:560px}
        .cell-title{max-width:200px}
    }
</style>
