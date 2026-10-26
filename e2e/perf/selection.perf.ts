/**
 * Замер скорости выделения (NFR-02, NFR-03): рамка по всей клавиатуре
 * туда-обратно; Ctrl+A, снятие выделения (Esc и клик по пустому месту),
 * Shift+стрелки, клик и серия быстрых кликов. Два набора данных: заготовка
 * Dota 2, профиль «Тестовый» (~80 биндов), и он же с 500 биндами (NFR-03).
 *
 * Запуск: npm run perf. Не входит в npm run e2e — цифры зависят от машины.
 * Цель: ни одного кадра дольше 50 мс и ответ на действие до 50 мс.
 *
 * Время ответа считается двумя способами:
 * - «кадр» — от нажатия до второго requestAnimationFrame, оценка сверху
 *   (включает ожидание до двух кадров, как в прежних замерах);
 * - «событие» — duration из Event Timing API: от нажатия до отрисовки кадра
 *   после обработчика, так же считает браузер для INP. Короче 16 мс браузер
 *   не сообщает — тогда 16.
 */

import { expect, test, type Page } from '@playwright/test'
import { APP_URL } from '../app-url.ts'
import { importPreset } from '../presets.ts'
import { bigProfileJson } from './big-profile.ts'

/** Ширина панели: две колонки, как у автора */
const PANEL_WIDTH = 800
/** Проходов рамки: туда, обратно, туда, обратно */
const PASSES = 4
/** Движений указателя за проход */
const STEPS = 60
/** Долгий кадр, мс (NFR-02) */
const LONG_FRAME_MS = 50
/** Порог Event Timing: короче браузер не сообщает */
const EVENT_MIN_MS = 16
/** Клавиши с биндами в обоих наборах — для серии быстрых кликов */
const BURST_KEYS = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyD', 'KeyF', 'KeyZ', 'KeyX', 'KeyC', 'KeyV']
/**
 * Замер сборки (PERF_URL): в сборке ?storage=browser не действует, и Chrome
 * просит папку. Сценарий прячет выбор папки до загрузки — приложение само
 * переходит в запасной режим, как в Firefox. Код приложения не меняется.
 */
const HIDE_FOLDER_PICKER = Boolean(process.env.PERF_URL)

type Dataset = 'dota' | 'big'

interface PerfWindow {
  __perf: {
    recording: boolean
    frames: number[]
    longTasks: number[]
    events: { start: number; duration: number }[]
    lastInput: number
  }
}

/** Сборщик кадров, долгих задач и событий — до загрузки приложения */
function installCollector(opts: { panelWidth: number; hidePicker: boolean }) {
  if (opts.hidePicker) delete (window as { showDirectoryPicker?: unknown }).showDirectoryPicker
  try {
    localStorage.setItem('hotkey-map:panel-width', String(opts.panelWidth))
  } catch {
    // без localStorage панель останется узкой
  }
  const perf = {
    recording: false,
    frames: [] as number[],
    longTasks: [] as number[],
    events: [] as { start: number; duration: number }[],
    lastInput: 0,
  }
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
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        perf.events.push({ start: e.startTime, duration: e.duration })
    }).observe({ type: 'event', durationThreshold: 16, buffered: false } as PerformanceObserverInit)
  } catch {
    // без Event Timing остаётся оценка по кадрам
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

const round = (n: number) => Math.round(n * 10) / 10

async function stopRecording(page: Page): Promise<FrameStats> {
  const { frames, longTasks } = await page.evaluate(() => {
    const p = (window as unknown as PerfWindow).__perf
    p.recording = false
    return { frames: p.frames, longTasks: p.longTasks }
  })
  const gaps = frames.slice(1).map((t, i) => t - (frames[i] ?? t))
  const sorted = [...gaps].sort((a, b) => a - b)
  return {
    frames: frames.length,
    maxFrameMs: round(sorted.at(-1) ?? 0),
    p95FrameMs: round(sorted[Math.floor(sorted.length * 0.95)] ?? 0),
    longFrames: gaps.filter((g) => g > LONG_FRAME_MS).length,
    longTasks: longTasks.length,
    maxLongTaskMs: round(Math.max(0, ...longTasks)),
  }
}

interface Latency {
  /** До второго кадра после нажатия, оценка сверху */
  paint: number
  /** Event Timing: самое долгое событие с момента `since` */
  event: number
}

/** Ответ на последнее действие; since — начало действия (по умолчанию — последнее нажатие) */
async function latency(page: Page, since?: number): Promise<Latency> {
  return page.evaluate(
    ([from, min]) =>
      new Promise<Latency>((resolve) => {
        requestAnimationFrame(() => {
          // Второй кадр — после того, как первый отрисован
          requestAnimationFrame(() => {
            const p = (window as unknown as PerfWindow).__perf
            const paint = Math.round(performance.now() - p.lastInput)
            const start = (from ?? p.lastInput) - 1
            // Записи Event Timing приходят после кадра — ждём задачу
            setTimeout(() => {
              const long = p.events.filter((e) => e.start >= start).map((e) => e.duration)
              resolve({ paint, event: Math.max(min, ...long) })
            }, 50)
          })
        })
      }),
    [since ?? null, EVENT_MIN_MS] as const,
  )
}

async function now(page: Page): Promise<number> {
  return page.evaluate(() => performance.now())
}

async function openProfile(page: Page, dataset: Dataset) {
  await page.addInitScript(installCollector, {
    panelWidth: PANEL_WIDTH,
    hidePicker: HIDE_FOLDER_PICKER,
  })
  // Относительный путь: у сборки адрес начинается с /hotkey-map/
  await page.goto(`.${APP_URL}`)
  if (dataset === 'dota') {
    await page.getByRole('button', { name: 'Из заготовок' }).click()
    await importPreset(page, 'Dota 2')
  } else {
    await expect(page.getByText('Добавьте первую игру')).toBeVisible()
    await page.getByTestId('import-input').setInputFiles({
      name: 'big.hotkeymap.json',
      mimeType: 'application/json',
      buffer: Buffer.from(bigProfileJson()),
    })
    await page
      .getByRole('dialog', { name: /^Импорт/ })
      .getByRole('button', { name: 'Импортировать' })
      .click()
    const done = page.getByRole('dialog', { name: 'Импорт выполнен' })
    await done.getByRole('button', { name: 'Закрыть' }).first().click()
    await expect(done).toBeHidden()
  }
  await page.getByRole('button', { name: 'Выбор профиля' }).click()
  await page.getByRole('menuitemradio', { name: 'Тестовый' }).click()
  await expect(page.getByTestId('current-profile')).toHaveText('Тестовый')
  await expect(page.locator('[data-input-code="KeyQ"]')).toContainText(/\S/)
}

/** Центр клавиши: в 3D — верхней грани, иначе клик может прийтись на соседа */
async function keyCenter(page: Page, code: string): Promise<{ x: number; y: number }> {
  const key = page.locator(`[data-input-code="${code}"]`)
  const top = key.locator('.cap3d-top')
  const box = (await top.count()) > 0 ? await top.boundingBox() : await key.boundingBox()
  if (!box) throw new Error(`no box for ${code}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** Цифры — сразу в вывод: упавший тест не должен их терять */
function report(browser: string, name: string, stats: object) {
  console.log(`PERF ${browser} | ${name} | ${JSON.stringify(stats)}`)
}

const max = (xs: number[]) => Math.max(...xs)

test.use({ viewport: { width: 1920, height: 1080 } })

for (const dataset of ['dota', 'big'] as const) {
  for (const view of ['3D', '2D'] as const) {
    const name = `${view}${dataset === 'big' ? ', 500 bindings' : ''}`

    test(`marquee across the keyboard, ${name}`, async ({ page, browserName }) => {
      await openProfile(page, dataset)
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
      await latency(page)
      const stats = await stopRecording(page)
      // Отпускание: панель строит полный список выделенных клавиш
      await startRecording(page)
      const upAt = await now(page)
      await page.mouse.up()
      const release = await latency(page, upAt)
      const releaseStats = await stopRecording(page)
      const selected = await page.locator('[data-input-code][data-selected]').count()
      report(browserName, `marquee ${name}`, {
        ...stats,
        msPerMove,
        selected,
        releaseMs: release.event,
        releaseMaxFrameMs: releaseStats.maxFrameMs,
      })
      expect(selected).toBeGreaterThan(80)
      expect.soft(stats.longFrames, `кадры > ${LONG_FRAME_MS} мс`).toBe(0)
      expect.soft(release.event, 'отпускание рамки, мс').toBeLessThanOrEqual(LONG_FRAME_MS)
    })

    test(`keys and clicks, ${name}`, async ({ page, browserName }) => {
      await openProfile(page, dataset)
      await page.getByRole('radio', { name: view }).click()
      await page.getByRole('radio', { name: 'Навигация' }).click()
      const stage = await page.getByTestId('device-stage').boundingBox()
      if (!stage) throw new Error('no layout')
      const empty = { x: stage.x + 6, y: stage.y + 6 }
      await page.mouse.click(empty.x, empty.y)

      const results: Record<string, Latency[]> = {
        ctrlA: [],
        escape: [],
        clickEmpty: [],
        shiftArrow: [],
        click: [],
      }
      const push = (key: string, l: Latency) => results[key]?.push(l)
      await startRecording(page)
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('Control+KeyA')
        push('ctrlA', await latency(page))
        await page.keyboard.press('Escape')
        push('escape', await latency(page))
        await page.keyboard.press('Control+KeyA')
        await latency(page)
        await page.mouse.click(empty.x, empty.y)
        push('clickEmpty', await latency(page))
      }
      await page.locator('[data-input-code="Backquote"]').click()
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Shift+ArrowRight')
        push('shiftArrow', await latency(page))
      }
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Shift+ArrowDown')
        push('shiftArrow', await latency(page))
      }
      for (const code of ['KeyQ', 'KeyW', 'KeyE', 'KeyR']) {
        const c = await keyCenter(page, code)
        await page.mouse.click(c.x, c.y)
        push('click', await latency(page))
      }
      const stats = await stopRecording(page)

      // Серия быстрых кликов: без ожидания кадра между ними
      const centers = await Promise.all(BURST_KEYS.map((code) => keyCenter(page, code)))
      await page.mouse.click(empty.x, empty.y)
      await latency(page)
      await startRecording(page)
      const burstAt = await now(page)
      for (let round = 0; round < 3; round++) {
        for (const c of centers) await page.mouse.click(c.x, c.y)
      }
      const burst = await latency(page, burstAt)
      const burstStats = await stopRecording(page)

      const worst = (key: string) => {
        const xs = results[key] ?? []
        return { paint: max(xs.map((l) => l.paint)), event: max(xs.map((l) => l.event)) }
      }
      const summary = {
        ctrlA: worst('ctrlA'),
        escape: worst('escape'),
        clickEmpty: worst('clickEmpty'),
        shiftArrow: worst('shiftArrow'),
        click: worst('click'),
        burstEventMs: burst.event,
        burstMaxFrameMs: burstStats.maxFrameMs,
        burstLongFrames: burstStats.longFrames,
      }
      report(browserName, `keys ${name}`, { ...stats, ...summary })
      for (const key of ['ctrlA', 'escape', 'clickEmpty', 'shiftArrow', 'click'] as const) {
        expect.soft(summary[key].event, `${key}, мс`).toBeLessThanOrEqual(LONG_FRAME_MS)
      }
      expect.soft(burst.event, 'серия кликов, мс').toBeLessThanOrEqual(LONG_FRAME_MS)
      expect.soft(burstStats.longFrames, 'серия кликов: кадры > 50 мс').toBe(0)
    })
  }
}
