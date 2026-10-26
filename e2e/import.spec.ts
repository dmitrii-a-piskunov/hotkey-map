import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { APP_URL } from './app-url.ts'

/** Красный квадрат 1×1 в PNG */
const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

interface ExportJson {
  scope: string
  games: { name: string; icon?: string }[]
  appSettings?: Record<string, unknown>
  icons?: Record<string, string>
}

async function exportAll(page: Page): Promise<ExportJson> {
  await page.getByRole('button', { name: 'Меню' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Всё' }).click()
  return JSON.parse(await readFile(await (await download).path(), 'utf-8')) as ExportJson
}

/** Иконка игры — её данные, а не имя файла: при импорте имя новое */
function comparable(file: ExportJson) {
  const games = file.games.map((g) => ({
    ...g,
    icon: g.icon === undefined ? undefined : file.icons?.[g.icon],
  }))
  const settings: Record<string, unknown> = { ...file.appSettings }
  delete settings.lastExportAt
  return { games, settings }
}

async function addPreset(page: Page, name: string) {
  await page.getByRole('button', { name: 'Выбор игры' }).click()
  await page.getByRole('menuitem', { name: 'Из заготовок' }).click()
  await page.getByRole('button', { name: `Добавить ${name}` }).click()
}

/** Перетаскивание файла в окно приложения (FR-21) */
async function dropFile(page: Page, fileName: string, content: string) {
  await page.evaluate(
    (file) => {
      const data = new DataTransfer()
      data.items.add(new File([file.content], file.fileName, { type: 'application/json' }))
      document.body.dispatchEvent(
        new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }),
      )
    },
    { fileName, content },
  )
}

test('TC-09: export everything and import into a clean browser (FR-21)', async ({
  page,
  browser,
}) => {
  await page.goto(APP_URL)
  await page.getByRole('button', { name: 'Создать игру' }).click()
  const create = page.getByRole('dialog', { name: 'Новая игра' })
  await create.getByLabel('Название').fill('Тестовая игра')
  await create.getByRole('button', { name: 'Создать' }).click()
  await page.getByTestId('icon-drop').evaluate((zone, base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const data = new DataTransfer()
    data.items.add(new File([bytes], 'icon.png', { type: 'image/png' }))
    zone.dispatchEvent(
      new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }),
    )
  }, PNG_1PX)
  await expect(page.getByTestId('icon-drop').locator('img')).toBeVisible()
  // Иконку в редактор бросили — окно импорта не открылось
  await expect(page.getByRole('dialog', { name: /^Импорт/ })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await addPreset(page, 'Dota 2')
  await page.getByRole('radio', { name: '2D' }).click()
  await expect(page.getByTestId('save-status')).toHaveText('Сохранено')

  const exported = await exportAll(page)
  expect(exported.games.map((g) => g.name)).toEqual(['Тестовая игра', 'Dota 2'])
  expect(Object.keys(exported.icons ?? {})).toHaveLength(1)

  // Чистый браузер: свой IndexedDB
  const clean = await browser.newContext()
  const other = await clean.newPage()
  await other.goto(APP_URL)
  await expect(other.getByText('Добавьте первую игру')).toBeVisible()
  await other.getByTestId('import-input').setInputFiles({
    name: 'all.hotkeymap.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  })
  const preview = other.getByRole('dialog', { name: /^Импорт/ })
  await expect(preview.getByTestId('import-game')).toHaveCount(2)
  await expect(preview).toContainText('Новая игра')
  await expect(preview).toContainText('настройки приложения тоже возьмутся из файла')
  await preview.getByRole('button', { name: 'Импортировать' }).click()
  const done = other.getByRole('dialog', { name: 'Импорт выполнен' })
  await expect(done.getByTestId('import-report')).toContainText('Добавлено игр: 2')
  await done.getByRole('button', { name: 'Закрыть' }).first().click()

  // Последняя выбранная игра — из настроек файла
  await expect(other.getByTestId('current-game')).toHaveText('Dota 2')
  await expect(other.getByRole('radio', { name: '2D' })).toBeChecked()
  await expect(other.getByTestId('save-status')).toHaveText('Сохранено')

  const reExported = await exportAll(other)
  expect(comparable(reExported)).toEqual(comparable(exported))

  // Иконка записана в новое хранилище и показывается
  await other.getByRole('button', { name: 'Выбор игры' }).click()
  await other.getByRole('menuitemradio', { name: /Тестовая игра/ }).click()
  await expect(other.getByRole('button', { name: 'Выбор игры' }).locator('img')).toBeVisible()
  await clean.close()
})

test('TC-10: a broken file shows errors and changes nothing (FR-21)', async ({ page }) => {
  await page.goto(APP_URL)
  await page.getByRole('button', { name: 'Из заготовок' }).click()
  await page.getByRole('button', { name: 'Добавить PUBG: BATTLEGROUNDS' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('save-status')).toHaveText('Сохранено')
  const before = comparable(await exportAll(page))

  const preset = JSON.parse(await readFile('src/presets/pubg.json', 'utf-8')) as {
    games: { actions: { name: string; contextId: string }[] }[]
  }
  const action = preset.games[0]?.actions[0]
  if (!action) throw new Error('no action in the preset')
  action.contextId = '99999999-9999-4999-8999-999999999999'
  await dropFile(page, 'broken.hotkeymap.json', JSON.stringify(preset))

  const dialog = page.getByRole('dialog', { name: 'Файл не импортирован' })
  await expect(dialog.getByTestId('import-errors')).toContainText(
    `Игра «PUBG: BATTLEGROUNDS» → действие «${action.name}» → contextId: Ссылка на несуществующий контекст`,
  )
  await dialog.getByRole('button', { name: 'Закрыть' }).first().click()

  await dropFile(page, 'notes.json', 'это не JSON')
  await expect(page.getByTestId('import-errors')).toContainText('Файл повреждён или это не JSON')
  await page.keyboard.press('Escape')

  expect(comparable(await exportAll(page))).toEqual(before)
})
