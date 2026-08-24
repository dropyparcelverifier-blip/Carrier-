<script>
    import { onMount } from 'svelte';
    import { role, showToast } from '$lib/stores.js';
    import * as api from '$lib/api.js';
    import { parseAmazonCSV } from '$lib/csv-parser.js';
    import { goto } from '$app/navigation';

    let myRole = $state('none');
    let busy = $state(false);
    let over = $state(false);
    let result = $state(null);
    let history = $state([]);
    let onFile = $state(0);
    let progress = $state('');

    role.subscribe(v => myRole = v);

    onMount(() => {
        load();
    });

    async function load() {
        const out = await api.uploadHistory();
        if (!out.ok) return;
        history = out.data.history;
        onFile = out.data.onFile;
    }

    function drop(e) {
        e.preventDefault(); over = false;
        const f = Array.from(e.dataTransfer.files).filter(x => x.name.toLowerCase().endsWith('.csv'));
        if (f.length) run(f);
        else showToast('CSV files only', 'err');
    }

    function pick(e) {
        const f = Array.from(e.target.files);
        if (f.length) run(f);
        e.target.value = '';
    }

    async function run(files) {
        busy = true; result = null;
        let added = 0, updated = 0, dropyRows = 0, csvRows = 0, itemsWritten = 0, writeErrors = 0;
        // rows the parser kept, split by warehouse
        let itemError = '';
        let covers = null;
        let backdated = 0;
        let observed = 0;
        let bmRows = 0;
        const skipped = [];

        for (const file of files) {
            progress = `Reading ${file.name}`;

            let parsed;
            try {
                parsed = parseAmazonCSV(await file.text());
            } catch {
                showToast(`Could not read ${file.name}`, 'err');
                continue;
            }

            csvRows += parsed.total_csv_rows;
            dropyRows += parsed.dropy_rows;
            bmRows += parsed.bm_rows ?? 0;

            if (parsed.kind === 'order') { skipped.push(file.name); continue; }
            if (!parsed.parcels.length) continue;

            progress = `Saving ${parsed.parcels.length} parcels`;

            const out = await api.pushUpload({
                filename: file.name,
                parcels: parsed.parcels,
                items: parsed.items,
                covers: parsed.covers
            });

            if (!out.ok) {
                showToast(out.reason === 'offline'
                    ? 'Upload did not complete — nothing was saved'
                    : 'Upload failed', 'err');
                busy = false; progress = '';
                return;
            }

            added += out.data.added;
            updated += out.data.updated;
            itemsWritten += out.data.itemsWritten;
            backdated += out.data.backdated ?? 0;
            observed += out.data.observedDeliveries ?? 0;
            writeErrors += out.data.writeErrors;
            if (out.data.itemError) itemError = out.data.itemError;
            if (parsed.covers) covers = parsed.covers;
            onFile = out.data.onFile;
        }

        result = { files: files.length, csvRows, added, updated, skipped, itemsWritten,
                   itemError, writeErrors, covers, backdated, observed, dropyRows, bmRows };

        if (skipped.length && !added && !updated)
            showToast('Order report has no tracking numbers', 'err');
        else
            showToast(added || updated ? `${added} new · ${updated} updated` : 'Nothing new to add', added || updated ? 'ok' : '');

        await load();
        progress = '';
        busy = false;
    }

    function day(ts) {
        return new Date(ts).toLocaleDateString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    }
</script>

<header class="appbar">
    <div class="appbar-row">
        <div>
            <p class="eyebrow">Amazon Business reports</p>
            <h1>Intake</h1>
        </div>
        <div class="dt-tally"><div><div class="n n-all">{onFile}</div><div class="l">On file</div></div></div>
    </div>
</header>

<div class="body">
    <div class="cols">
        <div>
            <label class="tray" class:over
                ondragover={(e) => { e.preventDefault(); over = true; }}
                ondragleave={() => over = false}
                ondrop={drop}>
                {#if busy}
                    <div class="spin"></div>
                    <p style="margin-top:12px">{progress || 'Working'}</p>
                {:else}
                    <div class="tray-ic">▤</div>
                    <h3>Drop the shipment report</h3>
                    <p>CSV · Dropy addresses are pulled out automatically</p>
                {/if}
                <input type="file" accept=".csv" multiple onchange={pick} style="display:none" disabled={busy} />
            </label>

            {#if result}
                <div class="receipt">
                    <h3>Last intake · {new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short'})} {new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</h3>
                    <div class="rline"><span>Files read</span><span>{result.files}</span></div>
                    <div class="rline"><span>Rows scanned</span><span>{result.csvRows.toLocaleString()}</span></div>
                    <div class="rline"><span>Abhi rows</span><span>{result.dropyRows.toLocaleString()}</span></div>
                    {#if result.bmRows}
                        <div class="rline"><span>BM rows</span><span>{result.bmRows.toLocaleString()}</span></div>
                    {/if}
                    <div class="rline"><span>New parcels</span><span style="color:var(--verify)">+{result.added}</span></div>
                    <div class="rline"><span>Status updates</span><span style="color:var(--hold)">{result.updated}</span></div>
                    <div class="rline"><span>Item detail</span><span>{result.itemsWritten.toLocaleString()}</span></div>
                    {#if result.observed}
                        <div class="rline"><span>Delivered today</span><span style="color:var(--verify)">{result.observed}</span></div>
                    {/if}
                    {#if result.backdated}
                        <div class="rline"><span>Back-dated</span><span style="color:var(--verify)">{result.backdated}</span></div>
                    {/if}
                    {#if result.covers}
                        <div class="rline"><span>Covers</span><span>{result.covers.from} → {result.covers.to}</span></div>
                    {/if}
                    {#if result.writeErrors}
                        <div class="rline"><span style="color:var(--alert)">Failed to save</span><span style="color:var(--alert)">{result.writeErrors}</span></div>
                    {/if}
                    <div class="rline tot"><span>On file now</span><span>{onFile}</span></div>
                </div>
                {#if result.writeErrors}
                    <div class="note" style="border-left-color:var(--alert)">
                        {result.writeErrors} record{result.writeErrors === 1 ? '' : 's'} could not be saved — most likely a dropped connection. Upload the same report again; anything already on file keeps its scan status.
                    </div>
                {/if}
                {#if result.itemError}
                    <div class="note" style="border-left-color:var(--alert)">
                        Item detail was not saved — run <b>migration_phase2.sql</b> in Supabase to create the parcel_items table. Parcels themselves are fine.
                    </div>
                {/if}
                {#if result.skipped?.length}
                    <div class="note" style="border-left-color:var(--alert)">
                        Skipped {result.skipped.join(', ')} — an order report carries no tracking numbers or addresses, so there are no parcels in it. Upload the shipment report instead.
                    </div>
                {/if}
            {/if}

            {#if result?.backdated}
                <div class="note">
                    {result.backdated} parcel{result.backdated === 1 ? ' was' : 's were'} scanned before this report arrived.
                    They are now marked received, dated to the original scan rather than to this upload.
                </div>
            {/if}

            <div class="note">
                Only the shipment report is needed here — it carries the tracking number, carrier, address and PO number. Re-uploading the same report is safe: records already on file keep their scan status.
            </div>
        </div>

        <div>
            <div class="sec"><h2>Intake history</h2><span>Last {history.length}</span></div>
            {#if history.length === 0}
                <div class="empty">
                    <div class="empty-ic">▤</div>
                    <h3>No reports yet</h3>
                    <p>Drop a shipment report to start the manifest.</p>
                </div>
            {:else}
                <div class="feed">
                    <div class="feed-h"><span>File</span><span>Result</span></div>
                    {#each history as h}
                        <div class="feed-i">
                            <div style="flex:1;min-width:0">
                                <div class="feed-k">{h.filename}</div>
                                <div style="font-family:var(--data);font-size:9px;color:var(--ink3);margin-top:2px">{day(h.uploaded_at)}</div>
                            </div>
                            <span class="feed-t" style="text-align:right">
                                +{h.parcels_added} new<br>{h.parcels_updated} upd
                            </span>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</div>
