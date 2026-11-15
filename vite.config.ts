import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base './' → funktioniert unter https://<user>.github.io/<repo>/ unabhängig vom Repo-Namen
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Astro-Planer – Astrofotografie',
        short_name: 'Astro-Planer',
        description: 'Wetter, Dämmerung, Mond, Planeten und Milchstraße für die Astrofotografie',
        lang: 'de',
        theme_color: '#0b1020',
        background_color: '#0b1020',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: { cacheName: 'osm-tiles', expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 14 } },
          },
          {
            urlPattern: /^https:\/\/gibs\.earthdata\.nasa\.gov\//,
            handler: 'CacheFirst',
            options: { cacheName: 'lp-tiles', expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 60 } },
          },
        ],
      },
    }),
  ],
});
