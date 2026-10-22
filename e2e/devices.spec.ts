import { expect, test, type Page } from '@playwright/test'
import { APP_URL } from './app-url.ts'

const key = (page: Page, code: string) => page.locator(`[data-input-code="${code}"]`)

async function selectedCodes(page: Page): Promise<string[]> {
  const codes = await page
    .locator('[data-input-code][data-selected]')
    .evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.inputCode ?? ''))
  return codes.sort()
}

for (const view of ['3D', '2D'] as const) {
  test.describe(`${view} view`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(APP_URL)
      await page.getByRole('radio', { name: view }).click()
      // Убираем фокус с кнопки шапки, чтобы стрелки не уходили в неё
      await page.mouse.click(5, 300)
    })

    test('TC-06: click, Shift+click, Ctrl+click', async ({ page }) => {
      await key(page, 'KeyQ').click()
      await key(page, 'KeyD').click({ modifiers: ['Shift'] })
      await key(page, 'KeyF').click({ modifiers: ['Control'] })
      expect(await selectedCodes(page)).toEqual(
        ['KeyA', 'KeyD', 'KeyE', 'KeyF', 'KeyQ', 'KeyS', 'KeyW'].sort(),
      )
    })

    test('TC-07: real key press selects the key', async ({ page }) => {
      await page.keyboard.press('KeyF')
      expect(await selectedCodes(page)).toEqual(['KeyF'])
    })

    test('marquee selects keys and click on empty space clears', async ({ page }) => {
      const q = await key(page, 'KeyQ').boundingBox()
      const w = await key(page, 'KeyW').boundingBox()
      if (!q || !w) throw new Error('no layout')
      const stage = await page.getByTestId('device-stage').boundingBox()
      if (!stage) throw new Error('no stage')
      // От пустого места над клавиатурой вниз к центру W
      await page.mouse.move(q.x + q.width / 2, stage.y + 5)
      await page.mouse.down()
      await page.mouse.move(w.x + w.width / 2, w.y + w.height / 2, { steps: 5 })
      await page.mouse.up()
      const codes = await selectedCodes(page)
      expect(codes).toContain('KeyQ')
      expect(codes).toContain('KeyW')

      await page.mouse.click(stage.x + 5, stage.y + 5)
      expect(await selectedCodes(page)).toEqual([])
    })
  })
}

test('TC-14: navigation with Shift+arrows', async ({ page }) => {
  await page.goto(APP_URL)
  await page.getByRole('radio', { name: 'Навигация' }).click()
  await key(page, 'KeyQ').click()
  await page.keyboard.press('Shift+ArrowRight')
  await page.keyboard.press('Shift+ArrowRight')
  expect(await selectedCodes(page)).toEqual(['KeyE', 'KeyQ', 'KeyW'])
})

test('arrows treat ЛКМ, Mouse 5 and Mouse 4 as keys in the F12, Delete and PgUp rows', async ({
  page,
}) => {
  await page.goto(APP_URL)
  await page.getByRole('radio', { name: 'Навигация' }).click()
  await key(page, 'MouseLeft').click()
  const steps: [string, string][] = [
    ['ArrowLeft', 'Knob'],
    ['ArrowLeft', 'F12'],
    ['ArrowRight', 'Knob'],
    ['ArrowRight', 'MouseLeft'],
    ['ArrowDown', 'Mouse5'],
    ['ArrowLeft', 'Delete'],
    ['ArrowRight', 'Mouse5'],
    ['ArrowDown', 'Mouse4'],
    ['ArrowLeft', 'PageUp'],
    ['ArrowRight', 'Mouse4'],
  ]
  for (const [arrow, expected] of steps) {
    await page.keyboard.press(arrow)
    expect(await selectedCodes(page), `${arrow} → ${expected}`).toEqual([expected])
  }
})

test('Shift+↓ keeps the column under F12 and the mouse continues the rows', async ({ page }) => {
  await page.goto(APP_URL)
  await page.getByRole('radio', { name: 'Навигация' }).click()

  await key(page, 'F12').click()
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowDown')
  expect(await selectedCodes(page)).toEqual(['Backslash', 'Backspace', 'Enter', 'F12'])

  await key(page, 'MouseLeft').click()
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft')
  await page.keyboard.press('Shift+ArrowDown')
  expect(await selectedCodes(page)).toEqual(
    ['Backspace', 'Delete', 'F11', 'F12', 'Knob', 'Mouse5', 'MouseLeft'].sort(),
  )
  await expect(key(page, 'Knob')).toHaveAttribute('data-rejected', 'true')
})

test('↑ follows the finger column: C → D → E → 4', async ({ page }) => {
  await page.goto(APP_URL)
  await page.getByRole('radio', { name: 'Навигация' }).click()
  await key(page, 'KeyC').click()
  for (const expected of ['KeyD', 'KeyE', 'Digit4']) {
    await page.keyboard.press('ArrowUp')
    expect(await selectedCodes(page)).toEqual([expected])
  }
})

test('Win in a Shift range stays red; a click on it keeps the selection', async ({ page }) => {
  await page.goto(APP_URL)
  await page.getByRole('radio', { name: 'Навигация' }).click()
  await key(page, 'ControlLeft').click()
  await page.keyboard.press('Shift+ArrowRight')
  expect(await selectedCodes(page)).toEqual(['ControlLeft', 'MetaLeft'])
  await expect(key(page, 'MetaLeft')).toHaveAttribute('data-rejected', 'true')
  await expect(page.locator('.cap-hint')).toHaveCount(0)

  // aria-disabled: Playwright считает клавишу неактивной, но клик по ней — часть поведения
  await key(page, 'MetaLeft').click({ force: true })
  expect(await selectedCodes(page)).toEqual(['ControlLeft', 'MetaLeft'])
  await expect(key(page, 'MetaLeft')).toHaveAttribute('data-rejected', 'true')
})

test('Shift+← adds one column per press and stays on a wide key', async ({ page }) => {
  await page.goto(APP_URL)
  await page.getByRole('radio', { name: 'Навигация' }).click()
  await key(page, 'Digit2').click()
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowDown')
  await page.keyboard.press('Shift+ArrowLeft')
  await page.keyboard.press('Shift+ArrowLeft')
  expect(await selectedCodes(page)).toEqual(
    [
      'Backquote',
      'CapsLock',
      'Digit1',
      'Digit2',
      'KeyA',
      'KeyQ',
      'KeyZ',
      'ShiftLeft',
      'Tab',
    ].sort(),
  )
  await page.keyboard.press('Shift+ArrowDown')
  expect(await selectedCodes(page)).toContain('ControlLeft')
  expect(await selectedCodes(page)).toContain('MetaLeft')
})
