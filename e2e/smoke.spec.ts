import { expect, test } from '@playwright/test'
import { APP_URL } from './app-url.ts'

test('app opens and shows the title', async ({ page }) => {
  await page.goto(APP_URL)
  await expect(page.getByRole('heading', { name: 'Hotkey Map' })).toBeVisible()
})
