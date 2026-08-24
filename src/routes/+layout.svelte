<script>
    import '../app.css';
    import { session, role, who, toast, stream } from '$lib/stores.js';
    import { logout } from '$lib/api.js';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';

    let { children, data } = $props();

    // The signed cookie is the source of truth; this mirrors it for components
    $effect(() => { session.set(data.user ?? null); });

    let r = $state('none');
    let name = $state('');
    let t = $state({ msg: '', type: '', visible: false });
    let path = $state('/');

    role.subscribe(v => r = v);
    who.subscribe(v => name = v);
    toast.subscribe(v => t = v);
    page.subscribe(p => path = p.url.pathname);

    /** Bombino has no scanning — they receive their own parcels — so its list
     *  is shorter. Intake and Settings are shared and appear in both. */
    const NAV_BM = [
        { p: '/bm',          ic: '◫', l: 'Overview' },
        { p: '/bm/parcels',  ic: '≡', l: 'Manifest' },
        { p: '/bm/boxes',    ic: '▤', l: 'Boxes' },
        { p: '/analysis',    ic: '◈', l: 'Analysis' },
        { p: '/upload',      ic: '↥', l: 'Intake' },
        { p: '/settings',    ic: '⚙', l: 'Settings' }
    ];

    let st = $state('dropy');
    stream.subscribe(v => st = v);

    function pickStream(v) {
        if (v === st) return;
        stream.set(v);
        // Land on the equivalent screen rather than wherever we happened to be
        goto(v === 'bm' ? '/bm' : '/dashboard');
    }

    const NAV = {
        admin: [
            { p: '/dashboard', ic: '◫', l: 'Overview' },
            { p: '/scan',      ic: '▣', l: 'Scan' },
            { p: '/parcels',   ic: '≡', l: 'Manifest' },
            { p: '/attention', ic: '!', l: 'Attention' },
            { p: '/boxes',     ic: '▤', l: 'Boxes' },
            { p: '/analysis',  ic: '◈', l: 'Analysis' },
            { p: '/upload',    ic: '↥', l: 'Intake' },
            { p: '/settings',  ic: '⚙', l: 'Settings' }
        ],
        cargo: [
            { p: '/overview', ic: '◫', l: 'Overview' },
            { p: '/scan',     ic: '▣', l: 'Scan' },
            { p: '/parcels',  ic: '≡', l: 'Manifest' }
        ],
        packer: [
            { p: '/boxes', ic: '▤', l: 'Boxes' }
        ]
    };

    let tabs = $derived(
        r === 'admin' ? (st === 'bm' ? NAV_BM : NAV.admin) : (NAV[r] ?? [])
    );

    async function out() {
        await logout();
        session.set(null);
        goto('/', { invalidateAll: true });
    }

    $effect(() => {
        if (r === 'none' && path !== '/') goto('/');
    });

    // Landing on a BM page directly — a bookmark, a refresh, a link — has to
    // set the stream too, or the switcher says Abhi while the page shows
    // Bombino and every request goes to the wrong warehouse.
    $effect(() => {
        const wants = path.startsWith('/bm') ? 'bm' : null;
        if (wants && st !== wants) stream.set(wants);
    });

</script>

{#if t.visible}
    <div class="toast"><div class={t.type}>{t.msg}</div></div>
{/if}

<div class="shell" class:bare={r === 'none'}>
{#if r !== 'none'}
        <nav class="nav">
            <div class="nav-brand">
                <h2>Dropy Scan</h2>
                <p>{name}</p>
            </div>
            {#if r === 'admin'}
                <!-- Two separate operations arriving in one report. The choice is
                     explicit and coloured, because a box built from the wrong
                     stream is a real mistake. -->
                <div class="switch">
                    <button class:on={st === 'dropy'} onclick={() => pickStream('dropy')}>Abhi</button>
                    <button class="bm" class:on={st === 'bm'} onclick={() => pickStream('bm')}>BM</button>
                </div>
            {/if}
            {#each tabs as tab}
                <button class:on={path.startsWith(tab.p)} onclick={() => goto(tab.p)}>
                    <span class="ic">{tab.ic}</span>{tab.l}
                </button>
            {/each}
            <button class="signout" onclick={out}>
                <span class="ic">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none"
                        stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
                        aria-hidden="true">
                        <path d="M12 3v9" /><path d="M6.5 6.5a8 8 0 1 0 11 0" />
                    </svg>
                </span>Sign out
            </button>
            <div class="nav-foot">
                <p>{name.toUpperCase()}<br>{new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase()}</p>
            </div>
        </nav>
    {/if}

    <div class="main">
        {#if r !== 'none'}
            <!-- Phone only. In the tab bar this sat under a thumb and got
                 pressed by accident. It is a normal element in the flow of the
                 page, directly above the header and sharing its colour, so it
                 scrolls away with it — nothing positioned, nothing to float. -->
            <div class="topstrip">
                <button class="signout-top" onclick={out} aria-label="Sign out">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none"
                        stroke="currentColor" stroke-width="2.2"
                        stroke-linecap="round" aria-hidden="true">
                        <path d="M12 3v9" />
                        <path d="M6.5 6.5a8 8 0 1 0 11 0" />
                    </svg>
                    <span>Sign out</span>
                </button>
            </div>
        {/if}
        {@render children()}
    </div>
</div>

<style>
    /* Desktop keeps sign-out at the foot of the side rail. */
    /* stream switcher */
    .switch{display:flex;margin:0 14px 12px;border:1px solid #3A3B42}
    .switch button{flex:1;background:#1F2025;border:none;color:#8E9098;
        font-family:var(--disp);font-size:10.5px;font-weight:700;letter-spacing:.11em;
        text-transform:uppercase;padding:9px 4px;width:auto}
    .switch button.on{background:var(--signal);color:#fff}
    .switch button.bm.on{background:#2563A8;color:#fff}

    .signout{color:#6A6C74}
    .signout .ic svg{display:block}

    /* Phone: a slim strip above the header, in normal flow. */
    .topstrip{background:var(--ink);display:flex;justify-content:flex-end;
        padding:calc(6px + var(--safe-top, 0px)) 12px 0}
    .signout-top{display:inline-flex;align-items:center;gap:6px;
        background:transparent;border:1px solid #33343A;color:#6A6C74;
        font-family:var(--disp);font-size:9.5px;font-weight:700;
        letter-spacing:.12em;text-transform:uppercase;padding:5px 10px}
    .signout-top:active{background:var(--alert);border-color:var(--alert);color:#fff}
    .signout-top svg{display:block}

    @media (max-width:899px){
        /* the tab bar keeps only the places you actually navigate to */
        .signout{display:none}
        /* the header sits flush under the strip, as one block */
        :global(.topstrip + .appbar){padding-top:10px}
    }
    @media (min-width:900px){
        .topstrip{display:none}
        .signout{margin-top:8px;border-top:1px solid #33343A;padding-top:14px !important}
    }
</style>
