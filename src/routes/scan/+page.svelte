<script>
    import { onMount, onDestroy } from 'svelte';
    import { role, who, showToast } from '$lib/stores.js';
    import { goto } from '$app/navigation';
    import * as api from '$lib/api.js';
    import * as beep from '$lib/feedback.js';
    import { clock, groupByDay, labelFor } from '$lib/time.js';

    let myRole = $state('none');
    let me = $state('');

    let mode = $state('cam');
    let keyed = $state('');
    let scanner = null;
    let live = $state(false);

    let counts = $state({ ok: 0, hold: 0, bad: 0 });
    let pending = $state({ total: 0, today: 0, yesterday: 0, older: 0 });
    let todayList = $state([]);
    let recent = $state([]);
    let openDay = $state('');

    let busy = $state(false);
    let retry = $state(null);
    let flash = $state(null);      // the parcel just logged, with an undo
    let flashTimer;

    /** Stops the same barcode logging twice while it sits in the camera's view. */
    let lastCode = '';
    let lastAt = 0;

    role.subscribe(v => myRole = v);
    who.subscribe(v => me = v);

    onMount(() => {
        refresh();
    });

    onDestroy(() => { stopCam(); clearTimeout(flashTimer); });

    async function refresh() {
        const out = await api.scanState();
        if (!out.ok) return;
        counts = out.data.counts;
        pending = out.data.pending ?? pending;
        todayList = out.data.todayList ?? [];
        recent = out.data.recent ?? [];
    }

    /* ── camera ── */
    async function startCam() {
        beep.unlock();          // a tap, so audio is allowed from here on
        mode = 'cam';
        live = true;
        try {
            const { Html5Qrcode } = await import('html5-qrcode');
            await new Promise(r => setTimeout(r, 120));
            scanner = new Html5Qrcode('cam');
            await scanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 300, height: 130 } },
                onRead,
                () => {}
            );
        } catch {
            showToast('Camera unavailable — key it in', 'err');
            live = false;
            mode = 'key';
        }
    }

    async function stopCam() {
        if (scanner) { try { await scanner.stop(); } catch {} scanner = null; }
        live = false;
    }

    /** The camera keeps running. A read logs straight away — no tap to confirm,
     *  because at volume that tap is the whole cost. */
    async function onRead(text) {
        const code = String(text || '').trim();
        if (!code) return;

        const now = Date.now();
        if (code === lastCode && now - lastAt < 2500) return;   // still in frame
        lastCode = code; lastAt = now;

        await log(code);
    }

    async function submitKeyed() {
        const t = keyed.trim();
        if (!t) return;
        keyed = '';
        await log(t);
    }

    /* ── log a parcel ── */
    async function log(code) {
        busy = true;
        retry = null;

        const out = await api.receive(code);
        busy = false;

        if (!out.ok) {
            beep.bad();
            retry = { code };
            showToast(out.reason === 'offline' ? 'Not saved — no connection' : 'Not saved', 'err');
            return;
        }

        const d = out.data;

        if (d.ok) {
            beep.ok();
            flash = { code, state: 'ok', at: d.data?.warehouse_received_at ?? new Date().toISOString() };
            // Show it immediately rather than waiting for the refresh
            todayList = [{ tracking_number: code, scanned_at: flash.at, scanned_by: me }, ...todayList];
            counts = { ...counts, ok: counts.ok + 1 };
            pending = { ...pending, total: Math.max(0, pending.total - 1) };
        } else if (d.reason === 'already') {
            beep.repeat();
            flash = { code, state: 'dup', at: d.data?.warehouse_received_at };
        } else {
            // Not on file. Cargo is not shown this — it is logged for the office,
            // who can see it under Attention. Nothing for the floor to act on.
            beep.repeat();
            await api.logUnmatched(code);
            flash = { code, state: 'unknown' };
        }

        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => { flash = null; }, 3500);

        refresh();
    }

    async function undo() {
        if (!flash || flash.state !== 'ok') return;
        const code = flash.code;
        flash = null;
        const out = await api.unreceive(code);
        if (!out.ok) { showToast('Could not undo', 'err'); return; }
        todayList = todayList.filter(x => x.tracking_number !== code);
        counts = { ...counts, ok: Math.max(0, counts.ok - 1) };
        showToast('Undone', 'ok');
        refresh();
    }

    async function retryNow() {
        if (!retry) return;
        const c = retry.code;
        retry = null;
        await log(c);
    }

    let byDay = $derived(groupByDay(recent, 'scanned_at', myRole));
    let tz = $derived(labelFor(myRole));
</script>

<header class="appbar">
    <div class="appbar-row">
        <div>
            <p class="eyebrow">{new Date().toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short'})} · {tz}</p>
            <h1>Scan</h1>
        </div>
        <div class="dt-tally">
            <div><div class="n n-ok">{counts.ok}</div><div class="l">Scanned</div></div>
            <div><div class="n n-hold">{pending.total}</div><div class="l">Pending</div></div>
        </div>
    </div>
    <div class="tally">
        <div><div class="n n-ok">{todayList.length}</div><div class="l">Today</div></div>
        <div><div class="n n-ok">{counts.ok}</div><div class="l">On hand</div></div>
        <div><div class="n n-hold">{pending.total}</div><div class="l">Pending</div></div>
    </div>
</header>

<div class="body">
    {#if retry}
        <div class="retry">
            <div>
                <div class="retry-h">Not saved</div>
                <div class="retry-m">{retry.code} was not logged. Nothing was lost.</div>
            </div>
            <button class="retry-b" onclick={retryNow}>Retry</button>
        </div>
    {/if}

    <div class="chips" style="margin:0 0 12px">
        <button class="chip" class:on={mode === 'cam'} onclick={startCam}>Camera</button>
        <button class="chip" class:on={mode === 'key'} onclick={() => { mode = 'key'; stopCam(); }}>Key in</button>
    </div>

    {#if mode === 'cam'}
        <!-- One fixed height, idle or live, so nothing jumps when scanning starts -->
        <div class="view">
            <div class="reg tl"></div><div class="reg tr"></div>
            <div class="reg bl"></div><div class="reg br"></div>
            {#if live}
                <div class="sweep"></div>
                <div class="livechip">● Scanning</div>
                <div id="cam" class="camhost"></div>
            {:else}
                <p class="view-hint">Camera off<br>Tap start to scan</p>
            {/if}
        </div>
        {#if !live}
            <button class="act" onclick={startCam}>Start camera</button>
        {:else}
            <button class="act ghost" onclick={stopCam}>Stop camera</button>
        {/if}
    {:else}
        <div class="field">
            <label for="k">Scan</label>
            <!-- svelte-ignore a11y_autofocus -->
            <input id="k" bind:value={keyed} placeholder="Tracking number or PO" autofocus
                autocomplete="off" autocapitalize="characters" spellcheck="false"
                onkeydown={(e) => e.key === 'Enter' && submitKeyed()} />
            <button class="field-btn" onclick={submitKeyed}>Log</button>
        </div>
    {/if}

    <!-- what just happened, with a moment to take it back -->
    {#if flash}
        <div class="flash" class:dup={flash.state !== 'ok'}>
            <span class="fcode">{flash.code}</span>
            <span class="fmsg">
                {#if flash.state === 'ok'}logged
                {:else if flash.state === 'dup'}already scanned{flash.at ? ` · ${clock(flash.at, myRole)}` : ''}
                {:else}not on the list — logged for the office{/if}
            </span>
            {#if flash.state === 'ok'}
                <button class="fundo" onclick={undo}>Undo</button>
            {/if}
        </div>
    {/if}

    {#if busy}<div class="loading"><div class="spin"></div></div>{/if}

    <!-- pending is a number to act on, not a list to read -->
    <button class="pendbar" onclick={() => goto('/parcels')}>
        <span class="pn">{pending.total}</span>
        <span class="pl">
            pending
            <small>{pending.today} today · {pending.yesterday} yesterday · {pending.older} older</small>
        </span>
        <span class="pgo">Calendar ›</span>
    </button>

    <div class="sec"><h2>Scanned today</h2><span>{todayList.length}</span></div>
    {#if todayList.length === 0}
        <div class="empty">
            <div class="empty-ic">▤</div>
            <h3>Nothing scanned yet</h3>
            <p>Scan a shipping label to log the first parcel of the day.</p>
        </div>
    {:else}
        <div class="rows">
            {#each todayList.slice(0, 40) as s}
                <div class="row">
                    <div class="row-mid">
                        <div class="row-trk">{s.tracking_number}</div>
                    </div>
                    <span class="mark ok">{clock(s.scanned_at, myRole)}</span>
                </div>
            {/each}
            {#if todayList.length > 40}
                <div class="rowmore">…and {todayList.length - 40} more today</div>
            {/if}
        </div>
    {/if}

    {#if byDay.length > 1}
        <div class="sec"><h2>Earlier days</h2><span>tap to open</span></div>
        <div class="rows">
            {#each byDay.slice(1) as g}
                <button class="dayrow" class:sel={openDay === g.key}
                    onclick={() => openDay = openDay === g.key ? '' : g.key}>
                    <span class="caret" class:up={openDay === g.key}>▸</span>
                    <span class="dayname">{g.label}</span>
                    <span class="daycount">{g.items.length}</span>
                </button>
                {#if openDay === g.key}
                    <div class="daylist">
                        {#each g.items as it}
                            <div class="dayitem">
                                <span class="ditrk">{it.tracking_number}</span>
                                <span class="ditime">{clock(it.scanned_at, myRole)}</span>
                            </div>
                        {/each}
                    </div>
                {/if}
            {/each}
        </div>
    {/if}
</div>

<style>
    /* html5-qrcode draws a dimming overlay sized to its own idea of the frame,
       which fights the fixed height. The corner marks do that job already. */
    :global(#qr-shaded-region){display:none !important}

    .livechip{position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:4;
        background:var(--verify);color:#fff;font-family:var(--disp);font-size:9px;font-weight:700;
        letter-spacing:.14em;text-transform:uppercase;padding:4px 11px}

    .flash{display:flex;align-items:center;gap:10px;background:var(--verify);color:#fff;
        padding:10px 12px;margin-top:10px;animation:drop .2s ease}
    .flash.dup{background:var(--hold)}
    .fcode{font-family:var(--data);font-size:12px;font-weight:600}
    .fmsg{font-family:var(--data);font-size:10.5px;opacity:.9;flex:1}
    .fundo{border:1.5px solid rgba(255,255,255,.55);background:none;color:#fff;
        font-family:var(--disp);font-size:9.5px;font-weight:700;letter-spacing:.1em;
        text-transform:uppercase;padding:4px 10px}

    .pendbar{width:100%;display:flex;align-items:center;gap:12px;margin-top:14px;
        border:1.5px solid var(--ink);background:#fff;padding:11px 13px;text-align:left}
    .pn{font-family:var(--data);font-size:26px;font-weight:600;color:var(--hold);line-height:1}
    .pl{flex:1;font-family:var(--disp);font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
    .pl small{display:block;font-family:var(--data);font-size:9.5px;font-weight:400;
        letter-spacing:0;text-transform:none;color:var(--ink2);margin-top:3px}
    .pgo{font-family:var(--disp);font-size:10px;font-weight:700;letter-spacing:.1em;
        text-transform:uppercase;color:var(--signal)}

    .rowmore{padding:9px 12px;font-family:var(--data);font-size:10px;color:var(--ink2);
        border-top:1px dashed var(--rule);text-align:center}

    .dayrow{width:100%;display:flex;align-items:center;gap:10px;padding:11px 12px;background:#fff;
        border:none;border-bottom:1px solid var(--rule);text-align:left}
    .dayrow:last-child{border-bottom:none}
    .dayrow.sel{background:var(--paper2)}
    .caret{font-size:10px;color:var(--ink3);transition:transform .15s;display:inline-block}
    .caret.up{transform:rotate(90deg)}
    .dayname{flex:1;font-family:var(--disp);font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
    .daycount{font-family:var(--data);font-size:13px;font-weight:600;color:var(--verify)}
    .daylist{background:var(--paper2);border-bottom:1px solid var(--rule);padding:4px 12px 8px}
    .dayitem{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dotted var(--rule)}
    .dayitem:last-child{border-bottom:none}
    .ditrk{font-family:var(--data);font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ditime{font-family:var(--data);font-size:10px;color:var(--ink2);white-space:nowrap}

    .retry{display:flex;align-items:center;gap:12px;background:#fff;border:1.5px solid var(--alert);
        border-left-width:4px;padding:11px 13px;margin-bottom:12px}
    .retry-h{font-family:var(--disp);font-size:12px;font-weight:700;letter-spacing:.14em;
        text-transform:uppercase;color:var(--alert)}
    .retry-m{font-family:var(--data);font-size:10px;color:var(--ink2);line-height:1.6;margin-top:3px}
    .retry-b{border:1.5px solid var(--alert);background:var(--alert);color:#fff;font-family:var(--disp);
        font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:9px 15px;flex-shrink:0}
</style>
