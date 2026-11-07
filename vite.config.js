import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.EYLO_GITHUB_PAGES === 'true' ? '/eyloai/' : '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    ...(process.env.EYLO_GITHUB_PAGES === 'true' ? [{
      name: 'eylo-github-pages-canonical',
      transformIndexHtml: html => html.replaceAll(
        'https://eyloai.vercel.app/',
        'https://panagiotagrosdouli.github.io/eyloai/',
      ),
    }] : []),
  ]
});
