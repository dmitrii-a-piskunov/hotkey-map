import { test } from '@playwright/test'
import { APP_URL } from '../app-url.ts'
import { importPreset } from '../presets.ts'

/**
 * Скриншоты главного экрана для README (npm run screenshots): заготовка Dota 2,
 * профиль «Тестовый» с биндами, 3D, подписи EN. Светлая и тёмная версии —
 * GitHub показывает нужную под тему читателя.
 */
for (const scheme of ['light', 'dark'] as const) {
  test(`main screen, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto(APP_URL)
    await page.getByRole('button', { name: 'Из заготовок' }).click()
    await importPreset(page, 'Dota 2')

    await page.getByRole('button', { name: 'Выбор профиля' }).click()
    await page.getByRole('menuitemradio', { name: 'Тестовый' }).click()
    await page
      .getByRole('radiogroup', { name: 'Язык подписей' })
      .getByRole('radio', { name: 'EN', exact: true })
      .click()
    await page.getByTestId('save-status').filter({ hasText: 'Сохранено' }).waitFor()

    // Полоса запасного режима: её видно только из-за ?storage=browser, в Chrome с папкой её нет
    await page
      .getByText('Данные хранятся в браузере. Для хранения')
      .evaluate((el) => el.closest('div')?.remove())

    await page.mouse.move(1, 1)
    await page.waitForTimeout(500)
    await page.screenshot({ path: `docs/images/main-3d-${scheme}.png` })
  })
}
