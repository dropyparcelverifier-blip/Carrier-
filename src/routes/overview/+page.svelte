<script>
    /**
     * The cargo team's landing screen.
     *
     * They had no overview at all — they arrived on Scan and had no way of
     * knowing what was waiting for them. This is that list.
     */
    import { role } from '$lib/stores.js';
    import { labelFor } from '$lib/time.js';
    import HoldBoard from '$lib/HoldBoard.svelte';

    let r = $state('none');
    role.subscribe(v => r = v);

    const today = new Date().toLocaleDateString('en-GB',
        { weekday: 'short', day: '2-digit', month: 'short' });
</script>

<header class="appbar">
    <div class="appbar-row">
        <div>
            <p class="eyebrow">{today} · Jamaica NY · {labelFor(r)}</p>
            <h1>Overview</h1>
        </div>
    </div>
</header>

<div class="body">
    <HoldBoard />
</div>
