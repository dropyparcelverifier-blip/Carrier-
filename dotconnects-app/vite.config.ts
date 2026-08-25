import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    // Listen on every interface so a phone on the same wifi can reach the
    // dev server. The Next app needed -H 0.0.0.0 passed by hand every time;
    // this bakes it in.
    host: true,
    port: 5173,
  },
  resolve: {
    alias: {
      // Vitest doesn't inherit SvelteKit's aliases — without this every
      // `$lib/...` import in a test fails to resolve.
      $lib: path.resolve('./src/lib'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
