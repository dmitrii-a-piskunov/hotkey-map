import { defineConfig, devices } from '@playwright/test'

/**
 * Замеры скорости (npm run perf): по одному тесту за раз, чтобы не мешали друг другу.
 * PERF_URL — замер готовой сборки (vite preview), только Firefox: Chrome без
 * ?storage=browser в сборке просит папку.
 */
const url = process.env.PERF_URL

export default defineConfig({
  testDir: './e2e/perf',
  testMatch: '**/*.perf.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 120_000,
  use: { baseURL: url ?? 'http://localhost:5173' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: url
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
      },
})
