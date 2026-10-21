import { expect, test } from '@playwright/test'

test('app opens and shows the title', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Hotkey Map' })).toBeVisible()
})
