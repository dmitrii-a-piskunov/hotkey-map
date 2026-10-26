import { defineConfig, devices } from '@playwright/test'

/** Скриншоты для README (npm run screenshots): пишет docs/images/main-3d-*.png */
export default defineConfig({
  testDir: './e2e/screenshots',
  testMatch: '**/*.shot.ts',
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:5173',
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1.25,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
