import { expect, test } from '@playwright/test'
import { APP_URL } from './app-url.ts'

const html = (page: import('@playwright/test').Page) => page.locator('html')

test('dark theme survives a reload; system theme follows the OS (FR-25)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto(APP_URL)
  await expect(page.getByTestId('save-status')).toHaveText('Сохранено')
  await expect(html(page)).not.toHaveClass(/dark/)

  await page.getByRole('button', { name: /^Тема/ }).click()
  await page.getByRole('menuitemradio', { name: 'Тёмная' }).click()
  await expect(html(page)).toHaveClass(/dark/)
  await expect(page.getByTestId('save-status')).toHaveText('Сохранено')

  await page.reload()
  await expect(html(page)).toHaveClass(/dark/)
  await expect(page.getByRole('button', { name: 'Тема: Тёмная' })).toBeVisible()

  await page.getByRole('button', { name: /^Тема/ }).click()
  await page.getByRole('menuitemradio', { name: 'Системная' }).click()
  await expect(html(page)).not.toHaveClass(/dark/)
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(html(page)).toHaveClass(/dark/)
})
