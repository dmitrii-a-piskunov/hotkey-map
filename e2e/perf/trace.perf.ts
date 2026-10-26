/**
 * Трассировка Chrome по сценариям замера: куда уходит время — JavaScript,
 * стили, раскладка, отрисовка. Только Chromium; запуск вручную:
 * TRACE=1 npm run perf -- --project=chromium -g trace
 */

import { expect, test, type Page } from '@playwright/test'
import { APP_URL } from '../app-url.ts'
import { importPreset } from '../presets.ts'
import { bigProfileJson } from './big-profile.ts'

test.skip(!process.env.TRACE, 'только по TRACE=1')
test.use({ viewport: { width: 1920, height: 1080 } })

interface TraceEvent {
  name: string
  ph: string
  dur?: number
  tid: number
  pid: number
  args?: { name?: string; data?: { type?: string } }
}

/** Время по видам работы на главном потоке страницы, мс */
function summarize(json: string): Record<string, number> {
  const { traceEvents } = JSON.parse(json) as { traceEvents: TraceEvent[] }
  const main = traceEvents.find(
    (e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain',
  )
  const on = traceEvents.filter((e) => e.ph === 'X' && e.tid === main?.tid && e.pid === main.pid)
  const sum = (names: string[]) =>
    Math.round(
      on.filter((e) => names.includes(e.name)).reduce((s, e) => s + (e.dur ?? 0), 0) / 1000,
    )
  const longest = (names: string[]) =>
    Math.round(
      Math.max(0, ...on.filter((e) => names.includes(e.name)).map((e) => e.dur ?? 0)) / 1000,
    )
  return {
    task: sum(['RunTask']),
    longestTask: longest(['RunTask']),
    script: sum([
      'EventDispatch',
      'FunctionCall',
      'TimerFire',
      'FireAnimationFrame',
      'RunMicrotasks',
    ]),
    style: sum(['UpdateLayoutTree', 'RecalculateStyles']),
    layout: sum(['Layout']),
    prePaint: sum(['PrePaint']),
    paint: sum(['Paint']),
    layerize: sum(['Layerize', 'UpdateLayer', 'CompositeLayers']),
    commit: sum(['Commit']),
    gc: sum(['MinorGC', 'MajorGC', 'V8.GC_SCAVENGER', 'BlinkGC.AtomicPhase']),
  }
}

async function open(page: Page, big: boolean, view: '3D' | '2D') {
  await page.addInitScript(() => {
    if (location.port !== '5173')
      delete (window as { showDirectoryPicker?: unknown }).showDirectoryPicker
    localStorage.setItem('hotkey-map:panel-width', '800')
  })
  await page.goto(`.${APP_URL}`)
  if (big) {
    await page.getByTestId('import-input').setInputFiles({
      name: 'big.hotkeymap.json',
      mimeType: 'application/json',
      buffer: Buffer.from(bigProfileJson()),
    })
    await page
      .getByRole('dialog', { name: /^Импорт/ })
      .getByRole('button', { name: 'Импортировать' })
      .click()
  } else {
    await page.getByRole('button', { name: 'Из заготовок' }).click()
    await importPreset(page, 'Dota 2')
  }
  const done = page.getByRole('dialog', { name: 'Импорт выполнен' })
  if (big) await done.getByRole('button', { name: 'Закрыть' }).first().click()
  await expect(done).toBeHidden()
  await page.getByRole('button', { name: 'Выбор профиля' }).click()
  await page.getByRole('menuitemradio', { name: 'Тестовый' }).click()
  await page.getByRole('radio', { name: view }).click()
  await page.getByRole('radio', { name: 'Навигация' }).click()
}

async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30))),
      ),
  )
}

for (const big of [false, true]) {
  for (const view of ['3D', '2D'] as const) {
    test(`trace ${view}${big ? ' big' : ''}`, async ({ page, browser }) => {
      test.setTimeout(240_000)
      await open(page, big, view)
      const stage = await page.getByTestId('device-stage').boundingBox()
      if (!stage) throw new Error('no stage')
      await page.mouse.click(stage.x + 6, stage.y + 6)
      await settle(page)

      const scenarios: [string, () => Promise<void>][] = [
        [
          'ctrlA x3',
          async () => {
            for (let i = 0; i < 3; i++) {
              await page.keyboard.press('Control+KeyA')
              await settle(page)
              await page.mouse.click(stage.x + 6, stage.y + 6)
              await settle(page)
            }
          },
        ],
        [
          'click x10',
          async () => {
            for (const code of [
              'KeyQ',
              'KeyW',
              'KeyE',
              'KeyR',
              'KeyD',
              'KeyF',
              'KeyZ',
              'KeyX',
              'KeyC',
              'KeyV',
            ]) {
              await page.locator(`[data-input-code="${code}"]`).click()
              await settle(page)
            }
          },
        ],
        [
          'shift+arrow x12',
          async () => {
            await page.locator('[data-input-code="Backquote"]').click()
            for (let i = 0; i < 12; i++) {
              await page.keyboard.press('Shift+ArrowRight')
              await settle(page)
            }
          },
        ],
        [
          'marquee',
          async () => {
            await page.mouse.click(stage.x + 6, stage.y + 6)
            await page.mouse.move(stage.x + 6, stage.y + 6)
            await page.mouse.down()
            for (let i = 1; i <= 60; i++) {
              await page.mouse.move(
                stage.x + 6 + (stage.width - 300) * (i / 60),
                stage.y + 6 + (stage.height - 12) * (i / 60),
              )
            }
            await page.mouse.up()
            await settle(page)
          },
        ],
      ]
      for (const [name, run] of scenarios) {
        await browser.startTracing(page, {
          categories: ['devtools.timeline', 'v8', 'disabled-by-default-devtools.timeline'],
        })
        await run()
        const buf = await browser.stopTracing()
        console.log(
          `TRACE ${view}${big ? ' big' : ''} | ${name} | ${JSON.stringify(summarize(buf.toString()))}`,
        )
      }
    })
  }
}
