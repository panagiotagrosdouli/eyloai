import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { localApiPlugin } from './scripts/dev/local-api.mjs'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Server-only settings stay in the Node process, never in Vite's public define.
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return {
    base: process.env.EYLO_GITHUB_PAGES === 'true' ? '/eyloai/' : '/',
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    plugins: [
      react(),
      localApiPlugin(),
      ...(process.env.EYLO_GITHUB_PAGES === 'true' ? [{
        name: 'eylo-github-pages-canonical',
        transformIndexHtml: html => html.replaceAll(
          'https://eyloai.vercel.app/',
          'https://panagiotagrosdouli.github.io/eyloai/',
        ),
      }] : []),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/@supabase/')) return 'supabase-vendor';
          },
        },
      },
    },
  };
});
