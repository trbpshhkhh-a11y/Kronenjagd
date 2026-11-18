import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// base './' => die statische Seite funktioniert in jedem Unterordner (z. B. GitHub Pages)
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@assets': path.resolve(__dirname, '../assets'),
      '@kronen/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    fs: { allow: ['..'] },
    proxy: { '/ws': { target: 'ws://localhost:8787', ws: true }, '/api': 'http://localhost:8787' },
  },
  build: { chunkSizeWarningLimit: 1500, assetsInlineLimit: 0 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Kronen sammeln',
        short_name: 'Kronen',
        description: 'Das Weihnachts-Brettspiel: Spielleiter-App und Nur-App-Modus',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#3b2112',
        theme_color: '#3b2112',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        globIgnores: ['**/*cyrillic*', '**/*greek*', '**/*vietnamese*', '**/*hebrew*', '**/*math*', '**/*symbols*'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        // WebSocket- und Lobby-/API-Anfragen niemals cachen
        navigateFallbackDenylist: [/^\/api\//, /^\/ws/],
        runtimeCaching: [{ urlPattern: ({ url }) => url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws'), handler: 'NetworkOnly' }],
      },
    }),
  ],
});
