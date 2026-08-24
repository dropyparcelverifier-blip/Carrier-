<script>
    import { role } from '$lib/stores.js';
    import { goto } from '$app/navigation';

    /** A tracking number. For an admin it opens the parcel's journey;
     *  for anyone else it is plain text, since Analysis is admin-only. */
    let { value = '', cls = '', style = '' } = $props();

    let r = $state('none');
    role.subscribe(v => r = v);

    function open(e) {
        e.stopPropagation();
        goto(`/analysis?t=${encodeURIComponent(value)}`);
    }
</script>

{#if r === 'admin'}
    <button class="trk-link {cls}" {style} onclick={open} title="Trace this parcel">{value}</button>
{:else}
    <span class={cls} {style}>{value}</span>
{/if}

<style>
    .trk-link{background:none;border:none;padding:0;font:inherit;color:inherit;text-align:left;
        cursor:pointer;border-bottom:1px dotted var(--ink3);max-width:100%;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .trk-link:hover{color:var(--signal);border-bottom-color:var(--signal)}
</style>
