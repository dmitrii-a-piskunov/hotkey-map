import { defineConfig, devices } from '@playwright/test'

/**
 * Проверка готовой сборки как PWA (npm run e2e:pwa): service worker, офлайн
 * (NFR-06). Собирает приложение и открывает его через vite preview. Только
 * Chromium: в сборке без ?storage=browser проверяется экран приветствия.
 */
export default defineConfig({
  testDir: './e2e/pwa',
  testMatch: '**/*.pwa.ts',
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173/hotkey-map/' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/hotkey-map/',
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
