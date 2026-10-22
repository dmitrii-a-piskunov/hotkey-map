import { expect, test } from '@playwright/test'
import { APP_URL } from './app-url.ts'

const saveStatus = (page: import('@playwright/test').Page) => page.getByTestId('save-status')

test('TC-11: settings survive a reload (FR-19)', async ({ page }) => {
  await page.goto(APP_URL)
  await expect(saveStatus(page)).toHaveText('Сохранено')

  await page.getByRole('radio', { name: '2D' }).click()
  await page.getByRole('radio', { name: 'RU', exact: true }).click()
  await expect(saveStatus(page)).toHaveText('Сохранение…')
  await expect(saveStatus(page)).toHaveText('Сохранено')

  await page.reload()
  await expect(page.getByRole('radio', { name: '2D' })).toBeChecked()
  await expect(page.getByRole('radio', { name: 'RU', exact: true })).toBeChecked()
  await expect(page.getByTestId('device-stage')).toHaveAttribute('data-view', '2d')
})

test('fallback storage shows the banner (FR-23)', async ({ page }) => {
  await page.goto(APP_URL)
  await expect(
    page.getByText('Данные хранятся в браузере. Для хранения в папке откройте в Chrome или Edge.'),
  ).toBeVisible()
})
