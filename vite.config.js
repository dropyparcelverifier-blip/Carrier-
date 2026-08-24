import { sveltekit } from '@sveltejs/kit/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
	// basicSsl gives the dev server a self-signed certificate. Browsers only
	// expose getUserMedia (the camera) on a secure origin, and http://192.168.x.x
	// is not one — so LAN scan testing needs it. In production Vercel supplies a
	// real certificate, and generating a throwaway one during the build would be
	// pointless work, so it is dev-only.
	plugins: command === 'serve' ? [sveltekit(), basicSsl()] : [sveltekit()],
	server: {
		host: true,   // listen on every interface, not just localhost
		port: 5173,
		strictPort: true
	}
}));
