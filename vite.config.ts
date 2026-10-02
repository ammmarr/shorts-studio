import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

const api = `http://localhost:${process.env.API_PORT ?? 3100}`;

export default defineConfig({
	root: 'src/web',
	plugins: [react()],
	server: {
		port: 5190,
		strictPort: true,
		proxy: {
			'/api/': api,
			'/media/': api,
			'/renders/': api,
		},
	},
	build: {
		outDir: '../../dist/web',
		emptyOutDir: true,
		// It runs locally, so one big bundle is fine.
		chunkSizeWarningLimit: 4000,
	},
});
