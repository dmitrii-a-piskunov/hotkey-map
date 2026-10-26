import { expect, type Page } from '@playwright/test'

/** «Добавить <заготовку>» → предпросмотр импорта → «Импортировать» → итог закрыт (FR-21, FR-22) */
export async function importPreset(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: `Добавить ${name}` }).click()
  await page
    .getByRole('dialog', { name: /^Импорт/ })
    .getByRole('button', { name: 'Импортировать' })
    .click()
  const done = page.getByRole('dialog', { name: 'Импорт выполнен' })
  await done.getByRole('button', { name: 'Закрыть' }).first().click()
  await expect(done).toBeHidden()
}
