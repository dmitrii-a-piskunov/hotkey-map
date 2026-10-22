import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react'
import { keyboardWidth } from '@/components/devices/device-geometry'
import { keyboard3d } from '@/components/keyboard/keyboard-3d-geometry'
import { Keyboard } from '@/components/keyboard/keyboard'
import { Mouse } from '@/components/mouse/mouse'
import { mouseScene } from '@/components/mouse/mouse-geometry'
import { rectFromPoints, type Point, type Rect } from '@/domain/geometry'
import { mouseCodeForWheel } from '@/domain/input'
import {
  marqueeSelect,
  rectSelect,
  type ClickModifiers,
  type HitBox,
  type InputCode,
  type SelectionState,
} from '@/domain/selection'
import { useSettings } from '@/features/data/store'
import { keyboardLayout, mouseLayout } from '@/features/devices/devices'
import { useDevicesStore } from '@/features/devices/store'
import { ru } from '@/i18n/ru'
import { useElementWidth } from '@/lib/use-element-width'
import { deviceTheme } from '@/styles/device-theme'

/** Расстояние между клавиатурой и мышью, в юнитах */
const DEVICE_GAP = 0.8
/** Сдвиг мыши, после которого начинается рамка, px */
const DRAG_THRESHOLD = 4
/** Как долго подсвечивать прокрутку, мс (FR-01: 80–120 мс) */
const WHEEL_PULSE_MS = 120
const MIN_UNIT = 24
/** Доля ширины сцены под устройства */
const FIT = 0.98
const MAX_UNIT = 72

/**
 * Место под клавиатуру и мышь, в юнитах — одно на оба вида: в 3D ближний
 * край шире, и без общего места мышь прыгала бы при переключении 2D/3D.
 */
const KEYBOARD_SLOT = Math.max(keyboardWidth(keyboardLayout), keyboard3d(keyboardLayout).box.w)
const MOUSE_SLOT = Math.max(
  mouseScene(mouseLayout, '2d').box.w,
  mouseScene(mouseLayout, '3d').box.w,
)
const TOTAL_UNITS = KEYBOARD_SLOT + DEVICE_GAP + MOUSE_SLOT

const { scene } = deviceTheme

/** Фон сцены и тень по теме приложения */
const SCENE_STYLE = {
  '--scene-bg': scene.light.background,
  '--scene-shadow': scene.light.shadow,
  '--scene-bg-dark': scene.dark.background,
  '--scene-shadow-dark': scene.dark.shadow,
} as CSSProperties

interface Drag {
  start: Point
  base: SelectionState
  additive: boolean
  active: boolean
  /** Вход, на котором начали: клик по нему выделяет, а не снимает выделение */
  startCode: InputCode | null
  /** Вход под указателем при нажатии — его обработает клик (Fn, Win и регулятор тоже) */
  clickCode: InputCode | null
  /** Вход, который показан нажатым с начала клика (FR-01, анимация нажатия) */
  pressedCode: InputCode | null
}

/** Вход под указателем и можно ли его выделить */
function inputAt(target: EventTarget): { code: InputCode; disabled: boolean } | null {
  if (!(target instanceof Element)) return null
  const el = target.closest<HTMLElement>('[data-input-code]')
  const code = el?.dataset.inputCode
  if (!el || !code) return null
  return { code, disabled: el.dataset.disabled !== undefined }
}

function toLocal(container: HTMLElement, r: Rect): Rect {
  const box = container.getBoundingClientRect()
  return { x: r.x - box.left, y: r.y - box.top, w: r.w, h: r.h }
}

/** Клавиши и кнопки мыши под рамкой — по экранным прямоугольникам, одинаково в 2D и 3D */
function keyHitBoxes(container: HTMLElement): HitBox[] {
  const nodes = container.querySelectorAll<HTMLElement>(
    ':is([data-kind="key"], [data-kind="knob"], [data-kind="mouse"])[data-input-code]',
  )
  return Array.from(nodes, (node) => {
    // В 3D рамка смотрит только на верхнюю грань: блок клавиши захватывает и
    // боковые грани, и рамка цепляла бы клавиши «позади». В 2D — вся клавиша
    const face = node.querySelector<HTMLElement>('.cap3d-top, .knob-top') ?? node
    const r = face.getBoundingClientRect()
    return {
      code: node.dataset.inputCode ?? '',
      rect: { x: r.left, y: r.top, w: r.width, h: r.height },
    }
  })
}

/** Клавиатура и мышь, выделение кликом и рамкой (FR-01, FR-02, FR-13) */
export function DeviceStage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [marquee, setMarquee] = useState<Rect | null>(null)

  const selection = useDevicesStore((s) => s.selection)
  const pressedList = useDevicesStore((s) => s.pressed)
  const inputMode = useSettings((s) => s.inputMode)
  const labelLang = useSettings((s) => s.labelLang)
  const view = useSettings((s) => s.view)
  const click = useDevicesStore((s) => s.click)

  const selected = useMemo(() => new Set(selection.selected), [selection])
  const pressed = useMemo(() => new Set(pressedList), [pressedList])

  const width = useElementWidth(containerRef)
  const unit = Math.min(MAX_UNIT, Math.max(MIN_UNIT, (width * FIT) / TOTAL_UNITS))

  const onSelect = useCallback(
    (code: InputCode, mods: ClickModifiers) => {
      click(code, mods)
    },
    [click],
  )

  const onWheelInput = useCallback((code: InputCode) => {
    const store = useDevicesStore.getState()
    store.press(code)
    store.selectOnly(code)
    window.setTimeout(() => {
      useDevicesStore.getState().release(code)
    }, WHEEL_PULSE_MS)
  }, [])

  // Прокрутка над областью клавиатуры и мыши выделяет «колесо вверх/вниз» (FR-03).
  // Нужен непассивный обработчик, чтобы страница не прокручивалась
  useEffect(() => {
    const el = containerRef.current
    if (!el || inputMode !== 'check') return
    function onWheel(e: WheelEvent) {
      const code = mouseCodeForWheel(mouseLayout, e.deltaY)
      if (!code) return
      e.preventDefault()
      onWheelInput(code)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
    }
  }, [inputMode, onWheelInput])

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    const hit = inputAt(e.target)
    // Клик по клавише показывает её нажатие, пока зажата кнопка
    const pressedCode = hit && !hit.disabled ? hit.code : null
    if (pressedCode) useDevicesStore.getState().press(pressedCode)
    dragRef.current = {
      start: { x: e.clientX, y: e.clientY },
      base: useDevicesStore.getState().selection,
      additive: e.ctrlKey || e.metaKey,
      active: false,
      startCode: hit?.code ?? null,
      clickCode: hit?.code ?? null,
      pressedCode,
    }
  }

  function releasePressed(drag: Drag) {
    if (drag.pressedCode) useDevicesStore.getState().release(drag.pressedCode)
    drag.pressedCode = null
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const container = containerRef.current
    if (!drag || !container) return
    const point = { x: e.clientX, y: e.clientY }
    if (!drag.active && Math.hypot(point.x - drag.start.x, point.y - drag.start.y) < DRAG_THRESHOLD)
      return
    if (!drag.active) {
      // Началась рамка — в том числе от клавиши. Нажатие не показываем, указатель
      // захватываем только сейчас, чтобы обычный клик доходил до клавиши
      drag.active = true
      releasePressed(drag)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    const area = rectFromPoints(drag.start, point)
    setMarquee(toLocal(container, area))
    const hits = rectSelect(keyHitBoxes(container), area)
    useDevicesStore.getState().setSelection(marqueeSelect(drag.base, hits, drag.additive))
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    dragRef.current = null
    setMarquee(null)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (!drag) return
    releasePressed(drag)
    if (drag.active) return
    const store = useDevicesStore.getState()
    // Клик по пустому месту снимает выделение
    if (drag.startCode === null) store.clearSelection()
    // Клик по клавише выделяет ту, на которой нажали: при нажатии клавиша
    // проседает, и отпускание у самого края может прийтись уже не на неё —
    // браузер тогда не отправит ей click
    else if (drag.clickCode !== null)
      store.click(drag.clickCode, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })
  }

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={ru.devices.stage}
      data-testid="device-stage"
      className="device-scene relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden select-none"
      style={SCENE_STYLE}
      data-view={view}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="flex items-center" style={{ gap: DEVICE_GAP * unit }}>
        <div className="flex justify-center" style={{ width: KEYBOARD_SLOT * unit }}>
          <Keyboard
            layout={keyboardLayout}
            unit={unit}
            labelLang={labelLang}
            view={view}
            selected={selected}
            pressed={pressed}
            onSelect={onSelect}
          />
        </div>
        <div className="flex justify-center" style={{ width: MOUSE_SLOT * unit }}>
          <Mouse
            layout={mouseLayout}
            unit={unit}
            view={view}
            selected={selected}
            pressed={pressed}
            onSelect={onSelect}
          />
        </div>
      </div>
      {marquee && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute border border-(--marquee-border) bg-(--marquee)"
          style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
        />
      )}
    </div>
  )
}
