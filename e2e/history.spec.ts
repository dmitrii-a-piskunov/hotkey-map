import { expect, test, type Page } from '@playwright/test'
import { APP_URL } from './app-url.ts'
import { importPreset } from './presets.ts'

const toast = (page: Page) => page.getByTestId('undo-toast')
const profile = (page: Page) => page.getByTestId('current-profile')

async function createGame(page: Page, name: string) {
  await page.getByRole('button', { name: 'Создать игру' }).click()
  await page.getByRole('dialog', { name: 'Новая игра' }).getByLabel('Название').fill(name)
  await page.getByRole('button', { name: 'Создать' }).click()
  await page.keyboard.press('Escape')
}

test('a deleted game comes back from the toast; buttons undo and redo (FR-24)', async ({
  page,
}) => {
  await page.goto(APP_URL)
  await createGame(page, 'Тестовая игра')
  const undo = page.getByRole('button', { name: 'Отменить', exact: true }).first()

  await page.getByRole('button', { name: 'Выбор игры' }).click()
  await page.getByRole('menuitem', { name: 'Удалить игру' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click()
  await expect(page.getByText('Добавьте первую игру')).toBeVisible()
  await expect(toast(page)).toContainText('Игра «Тестовая игра» удалена')

  await toast(page).getByRole('button', { name: 'Отменить' }).click()
  await expect(page.getByTestId('current-game')).toHaveText('Тестовая игра')
  await expect(toast(page)).toBeHidden()

  // Кнопки в шапке: повтор удаляет снова, отмена возвращает
  await page.getByRole('button', { name: 'Повторить' }).click()
  await expect(page.getByText('Добавьте первую игру')).toBeVisible()
  await undo.click()
  await expect(page.getByTestId('current-game')).toHaveText('Тестовая игра')
})

test('Ctrl+Z and Ctrl+Shift+Z work only in navigation mode (FR-24)', async ({ page }) => {
  await page.goto(APP_URL)
  await createGame(page, 'Тестовая игра')
  await page.getByRole('button', { name: 'Выбор профиля' }).click()
  await page.getByRole('menuitem', { name: 'Дублировать' }).click()
  await expect(profile(page)).toHaveText('Копия Основной')

  // Навигация — режим по умолчанию
  await page.mouse.click(5, 400)
  await page.keyboard.press('Control+KeyZ')
  await expect(profile(page)).toHaveText('Основной')
  await page.keyboard.press('Control+Shift+KeyZ')
  await expect(profile(page)).toHaveText('Копия Основной')

  // В проверке нажатий Ctrl+Z выделяет клавишу, а не отменяет
  await page.getByRole('radio', { name: 'Проверка нажатий' }).click()
  await page.mouse.click(5, 400)
  await page.keyboard.press('Control+KeyZ')
  await expect(profile(page)).toHaveText('Копия Основной')
  await expect(page.locator('[data-input-code="KeyZ"]')).toHaveAttribute('data-selected', 'true')
})

test('undo from the toast keeps the game editor open (FR-24)', async ({ page }) => {
  await page.goto(APP_URL)
  await page.getByRole('button', { name: 'Из заготовок' }).click()
  await importPreset(page, 'PUBG: BATTLEGROUNDS')
  await page.getByRole('button', { name: 'Редактор игры' }).click()
  const editor = page.getByRole('dialog', { name: 'PUBG: BATTLEGROUNDS' })
  await editor.getByRole('tab', { name: 'Действия' }).click()
  const rows = editor.locator('[data-sortable-id]')
  const count = await rows.count()

  await rows
    .first()
    .getByRole('button', { name: /^Удалить / })
    .click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click()
  await expect(rows).toHaveCount(count - 1)
  await expect(toast(page)).toContainText('удалено')

  await toast(page).getByRole('button', { name: 'Отменить' }).click()
  await expect(editor).toBeVisible()
  await expect(rows).toHaveCount(count)
})
