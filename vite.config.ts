import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isDev = command === 'serve'
  // Where the local dev backend (scripts/dev-backend.ts) is listening. The dev server proxies
  // `/api` to it so the app can be served over HTTPS (required for the camera on phones)
  // without the browser blocking the request as mixed content.
  const devBackend = env.DEV_BACKEND_URL || 'http://localhost:8787'

  return {
    plugins: [
      react(),
      // Self-signed certificate for `npm run dev`. Browsers only expose the camera on secure
      // origins, so the LAN URL must be https:// when testing the scanner on a phone. Serving
      // only; production is served over Vercel's own TLS.
      isDev && basicSsl(),
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
          // The installed app opens the door, not the marketing page: `/signin`
          // redirects straight to the shelf once a session exists.
          start_url: '/signin',
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
    // The `[spine] → action` request trace is a development aid: it prints the payload of
    // every call, which has no business in a deployed console. Marking it pure lets the
    // minifier drop the calls entirely. `console.error` is deliberately kept — it is how a
    // misconfigured deployment gets diagnosed from a phone.
    esbuild: { pure: isDev ? [] : ['console.debug'] },
    build: {
      // Shipping sourcemaps would publish the readable source of the whole app.
      sourcemap: false,
      target: 'es2022',
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
