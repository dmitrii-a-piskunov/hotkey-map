/**
 * Замер скорости выделения (NFR-02): рамка по всей клавиатуре туда-обратно,
 * Ctrl+A, Shift+стрелки и клик на заготовке Dota 2, профиль «Тестовый».
 *
 * Запуск: npm run perf. Не входит в npm run e2e — цифры зависят от машины.
 * Цель: ни одного кадра дольше 50 мс и ответ на действие до 50 мс.
 */

import { expect, test, type Page } from '@playwright/test'
import { APP_URL } from '../app-url.ts'
import { importPreset } from '../presets.ts'

/** Ширина панели: две колонки, как у автора */
const PANEL_WIDTH = 800
/** Проходов рамки: туда, обратно, туда, обратно */
const PASSES = 4
/** Движений указателя за проход */
const STEPS = 60
/** Долгий кадр, мс (NFR-02) */
const LONG_FRAME_MS = 50

interface PerfWindow {
  __perf: {
    recording: boolean
    frames: number[]
    longTasks: number[]
    lastInput: number
  }
}

/** Сборщик кадров и долгих задач — до загрузки приложения */
function installCollector(panelWidth: number) {
  try {
    localStorage.setItem('hotkey-map:panel-width', String(panelWidth))
  } catch {
    // без localStorage панель останется узкой
  }
  const perf = { recording: false, frames: [] as number[], longTasks: [] as number[], lastInput: 0 }
  ;(window as unknown as PerfWindow).__perf = perf
  const tick = (t: number) => {
    if (perf.recording) perf.frames.push(t)
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  try {
    new PerformanceObserver((list) => {
      if (!perf.recording) return
      for (const e of list.getEntries()) perf.longTasks.push(e.duration)
    }).observe({ type: 'longtask', buffered: false })
  } catch {
    // Firefox не знает longtask — остаются длительности кадров
  }
  const mark = (e: Event) => {
    perf.lastInput = e.timeStamp
  }
  window.addEventListener('keydown', mark, true)
  window.addEventListener('pointerdown', mark, true)
}

async function startRecording(page: Page) {
  await page.evaluate(() => {
    const p = (window as unknown as PerfWindow).__perf
    p.frames = []
    p.longTasks = []
    p.recording = true
  })
}

interface FrameStats {
  frames: number
  maxFrameMs: number
  p95FrameMs: number
  longFrames: number
  longTasks: number
  maxLongTaskMs: number
}

async function stopRecording(page: Page): Promise<FrameStats> {
  const { frames, longTasks } = await page.evaluate(() => {
    const p = (window as unknown as PerfWindow).__perf
    p.recording = false
    return { frames: p.frames, longTasks: p.longTasks }
  })
  const gaps = frames.slice(1).map((t, i) => t - (frames[i] ?? t))
  const sorted = [...gaps].sort((a, b) => a - b)
  const round = (n: number) => Math.round(n * 10) / 10
  return {
    frames: frames.length,
    maxFrameMs: round(sorted.at(-1) ?? 0),
    p95FrameMs: round(sorted[Math.floor(sorted.length * 0.95)] ?? 0),
    longFrames: gaps.filter((g) => g > LONG_FRAME_MS).length,
    longTasks: longTasks.length,
    maxLongTaskMs: round(Math.max(0, ...longTasks)),
  }
}

/** От последнего нажатия до кадра после обновления DOM, мс */
async function inputToPaint(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        requestAnimationFrame(() => {
          // Второй кадр — после того, как первый отрисован
          requestAnimationFrame(() => {
            const p = (window as unknown as PerfWindow).__perf
            resolve(Math.round(performance.now() - p.lastInput))
          })
        })
      }),
  )
}

async function openDotaTest(page: Page) {
  await page.addInitScript(installCollector, PANEL_WIDTH)
  // Относительный путь: у сборки адрес начинается с /hotkey-map/
  await page.goto(`.${APP_URL}`)
  await page.getByRole('button', { name: 'Из заготовок' }).click()
  await importPreset(page, 'Dota 2')
  await page.getByRole('button', { name: 'Выбор профиля' }).click()
  await page.getByRole('menuitemradio', { name: 'Тестовый' }).click()
  await expect(page.getByTestId('current-profile')).toHaveText('Тестовый')
  await expect(page.locator('[data-input-code="KeyQ"]')).toContainText(/\S/)
}

/** Цифры — сразу в вывод: упавший тест не должен их терять */
function report(browser: string, name: string, stats: object) {
  console.log(`PERF ${browser} | ${name} | ${JSON.stringify(stats)}`)
}

test.use({ viewport: { width: 1920, height: 1080 } })

for (const view of ['3D', '2D'] as const) {
  test(`marquee across the keyboard, ${view}`, async ({ page, browserName }) => {
    await openDotaTest(page)
    await page.getByRole('radio', { name: view }).click()
    await page.mouse.click(5, 300)

    const stage = await page.getByTestId('device-stage').boundingBox()
    const keyboard = await page.getByRole('group', { name: 'Клавиатура' }).boundingBox()
    const mouse = await page.getByRole('group', { name: 'Мышь' }).boundingBox()
    if (!stage || !keyboard || !mouse) throw new Error('no layout')
    // От пустого места слева сверху до правого нижнего угла мыши
    const from = {
      x: Math.max(stage.x + 4, keyboard.x - 12),
      y: Math.max(stage.y + 4, keyboard.y - 12),
    }
    const to = {
      x: Math.min(stage.x + stage.width - 4, mouse.x + mouse.width + 12),
      y: Math.min(
        stage.y + stage.height - 4,
        Math.max(keyboard.y + keyboard.height, mouse.y + mouse.height) + 12,
      ),
    }

    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await startRecording(page)
    const t0 = Date.now()
    for (let pass = 0; pass < PASSES; pass++) {
      const [a, b] = pass % 2 === 0 ? [from, to] : [to, from]
      for (let i = 1; i <= STEPS; i++) {
        const k = i / STEPS
        await page.mouse.move(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k)
      }
    }
    const msPerMove = Math.round(((Date.now() - t0) / (PASSES * STEPS)) * 10) / 10
    // Последний проход заканчивается на старте; уходим в конец — выделено всё
    await page.mouse.move(to.x, to.y)
    await inputToPaint(page)
    const stats = await stopRecording(page)
    await page.mouse.up()
    const selected = await page.locator('[data-input-code][data-selected]').count()
    report(browserName, `marquee ${view}`, { ...stats, msPerMove, selected })
    expect(selected).toBeGreaterThan(80)
    expect.soft(stats.longFrames, `кадры > ${LONG_FRAME_MS} мс`).toBe(0)
  })

  test(`Ctrl+A, Shift+arrows and click, ${view}`, async ({ page, browserName }) => {
    await openDotaTest(page)
    await page.getByRole('radio', { name: view }).click()
    await page.getByRole('radio', { name: 'Навигация' }).click()
    await page.mouse.click(5, 300)

    const latency: Record<string, number[]> = { ctrlA: [], shiftArrow: [], click: [] }
    await startRecording(page)
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Control+KeyA')
      latency.ctrlA?.push(await inputToPaint(page))
      await page.keyboard.press('Escape')
      await inputToPaint(page)
    }
    await page.locator('[data-input-code="Backquote"]').click()
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Shift+ArrowRight')
      latency.shiftArrow?.push(await inputToPaint(page))
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+ArrowDown')
      latency.shiftArrow?.push(await inputToPaint(page))
    }
    for (const code of ['KeyQ', 'KeyW', 'KeyE', 'KeyR']) {
      await page.locator(`[data-input-code="${code}"]`).click()
      latency.click?.push(await inputToPaint(page))
    }
    const stats = await stopRecording(page)
    const max = (xs: number[] = []) => Math.max(...xs)
    report(browserName, `keys ${view}`, {
      ...stats,
      maxCtrlAms: max(latency.ctrlA),
      maxShiftArrowMs: max(latency.shiftArrow),
      maxClickMs: max(latency.click),
    })
    expect.soft(max(latency.ctrlA), 'Ctrl+A, мс').toBeLessThanOrEqual(LONG_FRAME_MS)
    expect.soft(max(latency.shiftArrow), 'Shift+стрелка, мс').toBeLessThanOrEqual(LONG_FRAME_MS)
    expect.soft(max(latency.click), 'клик, мс').toBeLessThanOrEqual(LONG_FRAME_MS)
  })
}
