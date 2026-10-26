import { expect, test } from '@playwright/test'

const welcome = 'Добро пожаловать в Hotkey Map'

test('works offline after the first load (NFR-06)', async ({ page, context }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: welcome })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state),
    )
    .toBe('activated')
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: welcome })).toBeVisible()
  const presets = await page.evaluate(async () => {
    let n = 0
    for (const k of await caches.keys()) {
      n += (await (await caches.open(k)).keys()).filter((r) => /dota2|pubg/.test(r.url)).length
    }
    return n
  })
  expect(presets).toBe(2)
})
