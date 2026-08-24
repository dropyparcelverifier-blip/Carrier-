<script>
    import { onMount } from 'svelte';
    import { showToast } from '$lib/stores.js';
    import { login } from '$lib/api.js';
    import { goto, invalidateAll } from '$app/navigation';

    let username = $state('');
    let pin = $state('');
    let step = $state('user');   // user | pin
    let busy = $state(false);

    // Cargo lands on the overview rather than the scanner: knowing what is
    // waiting is the first thing they need, and the scanner is one tap away.
    const HOME = { admin: '/dashboard', cargo: '/overview', packer: '/boxes' };
    const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

    let { data } = $props();

    onMount(() => {
        // Already signed in — go straight through
        if (data?.user?.role) goto(HOME[data.user.role] ?? '/scan');
    });

    function toPin() {
        if (!username.trim()) { showToast('Enter your username', 'err'); return; }
        step = 'pin';
    }

    function tap(k) {
        if (busy) return;
        if (k === '⌫') { pin = pin.slice(0, -1); return; }
        if (pin.length < 4) pin += k;
        if (pin.length === 4) verify();
    }

    async function verify() {
        busy = true;

        const out = await login(username.trim(), pin);

        if (out.ok) {
            await invalidateAll();
            goto(HOME[out.data.user.role] ?? '/scan');
            return;
        }

        pin = '';
        busy = false;

        if (out.reason === 'offline')      showToast('Cannot reach the server', 'err');
        else if (out.reason === 'locked')  showToast(out.message, 'err');
        else                               showToast('Username or PIN not recognised', 'err');
    }

    function back() { step = 'user'; pin = ''; }
</script>

<div class="pinwrap">
    <div style="text-align:center">
        <p class="eyebrow" style="color:var(--ink2)">Receiving terminal</p>
        <h1 style="font-family:var(--disp);font-size:29px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-top:5px">Dropy Scan</h1>
        <div style="width:52px;height:3px;background:var(--signal);margin:11px auto 0"></div>
    </div>

    {#if step === 'user'}
        <div style="width:100%;max-width:290px;margin-top:34px">
            <div class="field">
                <label for="u">User</label>
                <!-- svelte-ignore a11y_autofocus -->
                <input id="u" bind:value={username} placeholder="username"
                    autocomplete="username" autocapitalize="none" spellcheck="false" autofocus
                    onkeydown={(e) => e.key === 'Enter' && toPin()} />
            </div>
            <button class="act" onclick={toPin}>Continue</button>
        </div>
        <p style="font-family:var(--data);font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);margin-top:26px">
            Station 01 · Jamaica NY
        </p>
    {:else}
        <p style="font-family:var(--data);font-size:11px;color:var(--ink2);margin-top:22px;letter-spacing:.06em">
            {username.trim().toLowerCase()}
        </p>

        <div class="slots">
            {#each [0,1,2,3] as i}
                <div class="slot" class:f={i < pin.length}>{i < pin.length ? '•' : ''}</div>
            {/each}
        </div>

        {#if busy}
            <div style="height:200px;display:grid;place-items:center"><div class="spin"></div></div>
        {:else}
            <div class="keys">
                {#each KEYS as k}
                    {#if k === ''}
                        <div class="key blank"></div>
                    {:else}
                        <button class="key" class:fn={k === '⌫'} onclick={() => tap(k)}>{k}</button>
                    {/if}
                {/each}
            </div>
            <button class="act ghost" style="max-width:290px;margin-top:14px" onclick={back}>
                Not you? Change user
            </button>
        {/if}
    {/if}
</div>
