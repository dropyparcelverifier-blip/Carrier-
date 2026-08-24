<script>
    /**
     * Order IDs, linked to Amazon.
     *
     * Admin only — cargo and packers have no Amazon account to open them
     * with, and the link would only be a dead end on the warehouse floor.
     */
    import { role } from '$lib/stores.js';

    let { ids = [], compact = false } = $props();

    let r = $state('none');
    role.subscribe(v => r = v);

    let list = $derived(
        (Array.isArray(ids) ? ids : [ids])
            .map(x => String(x ?? '').trim())
            .filter(Boolean)
    );
</script>

{#if r === 'admin' && list.length}
    <span class="ids" class:compact>
        {#each list as id}
            <a href="https://www.amazon.com/your-orders/order-details?orderID={encodeURIComponent(id)}"
                target="_blank" rel="noopener noreferrer" title="Open on Amazon">{id}</a>
        {/each}
    </span>
{/if}

<style>
    .ids{display:inline-flex;flex-wrap:wrap;gap:4px 8px;vertical-align:middle}
    .ids a{font-family:var(--data);font-size:10px;color:var(--signal);text-decoration:none;
        border-bottom:1px solid var(--signal);white-space:nowrap}
    .ids a:hover{background:var(--signal);color:#fff;border-bottom-color:transparent}
    .compact a{font-size:9.5px}
</style>
