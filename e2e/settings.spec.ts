import { expect, test } from '@playwright/test'
import { APP_URL } from './app-url.ts'

test('a backup is restored from settings; the version is shown (FR-20)', async ({ page }) => {
  await page.goto(APP_URL)
  await page.getByRole('button', { name: 'Создать игру' }).click()
  await page
    .getByRole('dialog', { name: 'Новая игра' })
    .getByLabel('Название')
    .fill('Игра из копии')
  await page.getByRole('button', { name: 'Создать' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('save-status')).toHaveText('Сохранено')

  // Новый запуск: первое изменение кладёт data.json запуска в копию
  await page.reload()
  await page.getByRole('button', { name: 'Выбор игры' }).click()
  await page.getByRole('menuitem', { name: 'Удалить игру' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click()
  await expect(page.getByText('Добавьте первую игру')).toBeVisible()
  await expect(page.getByTestId('save-status')).toHaveText('Сохранено')

  await page.getByRole('button', { name: 'Меню' }).click()
  await page.getByRole('menuitem', { name: 'Настройки…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Настройки' })
  await expect(dialog.getByTestId('settings-version')).toHaveText(/^\d+\.\d+\.\d+$/)
  await expect(dialog).toContainText('Данные хранятся в браузере')

  const backups = dialog.getByRole('list', { name: 'Резервные копии' })
  await expect(backups.getByRole('listitem')).toHaveCount(1)
  await backups.getByRole('button', { name: 'Восстановить' }).click()
  await backups.getByRole('button', { name: 'Да' }).click()
  await expect(dialog.getByRole('status')).toContainText('Данные восстановлены из копии')
  // Текущее состояние перед восстановлением тоже легло в копию
  await expect(backups.getByRole('listitem')).toHaveCount(2)

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('current-game')).toHaveText('Игра из копии')
})
