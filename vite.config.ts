import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string
}

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the app from /hotkey-map/; dev server stays at the root.
  base: command === 'build' || isPreview ? '/hotkey-map/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    // FR-28, NFR-06: офлайн после первой загрузки; новая версия — только по кнопке «Обновить»
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Hotkey Map',
        short_name: 'Hotkey Map',
        description: 'Бинды игр на объёмной клавиатуре и мыши',
        lang: 'ru',
        display: 'standalone',
        theme_color: '#111827',
        background_color: '#111827',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    // Виртуальный модуль vite-plugin-pwa в Vitest не резолвится: service worker в jsdom нет
    alias: {
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./tests/mocks/pwa-register.ts', import.meta.url),
      ),
    },
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      thresholds: {
        // NFR-10: domain logic coverage target
        'src/domain/**': { lines: 70, functions: 70, branches: 70, statements: 70 },
      },
    },
  },
}))
