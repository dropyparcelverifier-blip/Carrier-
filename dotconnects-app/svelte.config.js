import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      /**
       * Pinned, not inferred.
       *
       * By default the adapter derives the Vercel runtime from whatever
       * Node the BUILD machine happens to run, and refuses outright if
       * that version isn't one Vercel offers. Node 25 is odd-numbered
       * with no LTS window, so it isn't — the build succeeds and then
       * the adapter fails at the very last step.
       *
       * Pinning also makes production deterministic: the function runs
       * on nodejs22.x regardless of what anyone has installed locally,
       * rather than quietly changing when a developer upgrades Node.
       */
      runtime: 'nodejs22.x',
    }),
    alias: {
      $lib: 'src/lib',
    },
  },
};
