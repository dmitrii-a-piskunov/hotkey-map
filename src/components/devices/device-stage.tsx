import {
  useCallback,
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
import {
  marqueeSelect,
  rectSelect,
  type ClickModifiers,
  type HitBox,
  type InputCode,
  type SelectionState,
} from '@/domain/selection'
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

/** Ширина клавиатуры и мыши вместе, в юнитах: в 3D ближний край шире */
const TOTAL_UNITS = {
  '2d': keyboardWidth(keyboardLayout) + DEVICE_GAP + mouseScene(mouseLayout, '2d').box.w,
  '3d': keyboard3d(keyboardLayout).box.w + DEVICE_GAP + mouseScene(mouseLayout, '3d').box.w,
}

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
}

function toLocal(container: HTMLElement, r: Rect): Rect {
  const box = container.getBoundingClientRect()
  return { x: r.x - box.left, y: r.y - box.top, w: r.w, h: r.h }
}

/** Клавиши под рамкой — по экранным прямоугольникам, одинаково в 2D и 3D */
function keyHitBoxes(container: HTMLElement): HitBox[] {
  const nodes = container.querySelectorAll<HTMLElement>(
    '[data-kind="key"][data-input-code]:not([data-disabled])',
  )
  return Array.from(nodes, (node) => {
    const r = node.getBoundingClientRect()
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
  const inputMode = useDevicesStore((s) => s.inputMode)
  const labelLang = useDevicesStore((s) => s.labelLang)
  const view = useDevicesStore((s) => s.view)
  const click = useDevicesStore((s) => s.click)

  const selected = useMemo(() => new Set(selection.selected), [selection])
  const pressed = useMemo(() => new Set(pressedList), [pressedList])

  const width = useElementWidth(containerRef)
  const unit = Math.min(MAX_UNIT, Math.max(MIN_UNIT, (width * FIT) / TOTAL_UNITS[view]))

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

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    dragRef.current = {
      start: { x: e.clientX, y: e.clientY },
      base: useDevicesStore.getState().selection,
      additive: e.ctrlKey || e.metaKey,
      active: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const container = containerRef.current
    if (!drag || !container) return
    const point = { x: e.clientX, y: e.clientY }
    if (!drag.active && Math.hypot(point.x - drag.start.x, point.y - drag.start.y) < DRAG_THRESHOLD)
      return
    drag.active = true
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
    // Клик по пустому месту снимает выделение
    if (drag && !drag.active) useDevicesStore.getState().clearSelection()
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
        <Keyboard
          layout={keyboardLayout}
          unit={unit}
          labelLang={labelLang}
          view={view}
          selected={selected}
          pressed={pressed}
          onSelect={onSelect}
        />
        <Mouse
          layout={mouseLayout}
          unit={unit}
          view={view}
          selected={selected}
          pressed={pressed}
          onSelect={onSelect}
          onWheelInput={inputMode === 'check' ? onWheelInput : null}
        />
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
