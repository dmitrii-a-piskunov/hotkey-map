import { expect, test } from '@playwright/test'
import { APP_URL } from './app-url.ts'

const banner = 'Приложение уже открыто в другой вкладке'

test('the second tab is view-only; after the first closes a new tab writes again (FR-27)', async ({
  context,
}) => {
  const first = await context.newPage()
  await first.goto(APP_URL)
  await first.getByRole('button', { name: 'Создать игру' }).click()
  await first.getByRole('dialog', { name: 'Новая игра' }).getByLabel('Название').fill('Игра')
  await first.getByRole('button', { name: 'Создать' }).click()
  await first.keyboard.press('Escape')
  await expect(first.getByTestId('save-status')).toHaveText('Сохранено')
  await expect(first.getByText(banner)).toHaveCount(0)

  const second = await context.newPage()
  await second.goto(APP_URL)
  await expect(second.getByText(banner)).toBeVisible()
  await expect(second.getByTestId('current-game')).toHaveText('Игра')

  // Удаление во второй вкладке не применяется
  await second.getByRole('button', { name: 'Выбор игры' }).click()
  await second.getByRole('menuitem', { name: 'Удалить игру' }).click()
  await second.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click()
  await expect(second.getByTestId('current-game')).toHaveText('Игра')

  await first.close()
  await second.close()
  const third = await context.newPage()
  await third.goto(APP_URL)
  await expect(third.getByTestId('current-game')).toHaveText('Игра')
  await expect(third.getByText(banner)).toHaveCount(0)
})
