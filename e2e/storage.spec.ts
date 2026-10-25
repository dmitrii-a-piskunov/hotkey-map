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

test('TC-21: the black keyboard color survives a reload (FR-01)', async ({ page }) => {
  await page.goto(APP_URL)
  await expect(saveStatus(page)).toHaveText('Сохранено')
  const escTop = () =>
    page
      .locator('[data-input-code="Escape"]')
      .evaluate((el) => (el as HTMLElement).style.getPropertyValue('--cap-top'))
  const standardTop = await escTop()

  await page.getByRole('radio', { name: 'Чёрная' }).click()
  await expect.poll(escTop).not.toBe(standardTop)
  const blackTop = await escTop()
  await expect(saveStatus(page)).toHaveText('Сохранено')

  await page.reload()
  await expect(page.getByRole('radio', { name: 'Чёрная' })).toBeChecked()
  expect(await escTop()).toBe(blackTop)
})

test('fallback storage shows the banner (FR-23)', async ({ page }) => {
  await page.goto(APP_URL)
  await expect(
    page.getByText('Данные хранятся в браузере. Для хранения в папке откройте в Chrome или Edge.'),
  ).toBeVisible()
})
