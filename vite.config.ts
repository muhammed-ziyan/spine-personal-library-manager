import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Where the local dev backend (scripts/dev-backend.ts) is listening. The dev server proxies
  // `/api` to it so the app can be served over HTTPS (required for the camera on phones)
  // without the browser blocking the request as mixed content.
  const devBackend = env.DEV_BACKEND_URL || 'http://localhost:8787'

  return {
    plugins: [
      react(),
      // Self-signed certificate for `npm run dev`. Browsers only expose the camera on secure
      // origins, so the LAN URL must be https:// when testing the scanner on a phone.
      basicSsl(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Spine — Personal Library',
          short_name: 'Spine',
          description: 'Every book you own, in your pocket.',
          theme_color: '#f5ead8',
          background_color: '#f5ead8',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Cache the app shell (including the self-hosted fonts) only. Library data always goes to the network;
          // offline sync is intentionally out of scope for V1.
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: '/index.html',
        },
      }),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': { target: devBackend, changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, '') },
      },
    },
  }
})
