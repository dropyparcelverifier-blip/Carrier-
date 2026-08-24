<script>
    import { barSet } from '$lib/barcode.js';
    let { value = '', height = 38, scale = 1.5, cls = 'bars' } = $props();
    let set = $derived(barSet(value, height, scale));
</script>

<div class={cls}>
    {#each set as b}
        <i style="width:{b.w}px;height:{b.h}px;{b.faint ? 'opacity:.06' : ''}"></i>
    {/each}
</div>
