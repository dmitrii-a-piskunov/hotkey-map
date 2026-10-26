import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { APP_URL } from './app-url.ts'
import { importPreset } from './presets.ts'

async function exportVia(page: Page, item: string) {
  await page.getByRole('button', { name: 'Меню' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: item }).click()
  const file = await download
  const path = await file.path()
  return {
    name: file.suggestedFilename(),
    json: JSON.parse(await readFile(path, 'utf-8')) as {
      scope: string
      games: { name: string; profiles: { name: string }[] }[]
      appSettings?: { lastExportAt?: string }
    },
  }
}

test('export of everything, a game and a profile downloads files (FR-21)', async ({ page }) => {
  await page.goto(APP_URL)
  await page.getByRole('button', { name: 'Из заготовок' }).click()
  await importPreset(page, 'PUBG: BATTLEGROUNDS')

  const all = await exportVia(page, 'Всё')
  expect(all.name).toMatch(/^hotkeymap-\d{4}-\d{2}-\d{2}\.hotkeymap\.json$/)
  expect(all.json.scope).toBe('all')
  expect(all.json.games.map((g) => g.name)).toEqual(['PUBG: BATTLEGROUNDS'])
  expect(all.json.appSettings?.lastExportAt).toBeTruthy()

  const game = await exportVia(page, 'Текущая игра')
  expect(game.name).toMatch(/^pubg-battlegrounds-\d{4}-\d{2}-\d{2}\.hotkeymap\.json$/)
  expect(game.json.scope).toBe('game')

  const profile = await exportVia(page, 'Текущий профиль')
  expect(profile.json.scope).toBe('profile')
  expect(profile.json.games[0]?.profiles).toHaveLength(1)
})
