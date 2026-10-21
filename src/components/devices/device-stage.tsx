import { useCallback, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Keyboard, KEYBOARD_PADDING } from '@/components/keyboard/keyboard'
import { Mouse, MOUSE_PADDING } from '@/components/mouse/mouse'
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

/** Расстояние между клавиатурой и мышью, в юнитах */
const DEVICE_GAP = 0.8
/** Сдвиг мыши, после которого начинается рамка, px */
const DRAG_THRESHOLD = 4
/** Как долго подсвечивать прокрутку, мс (FR-01: 80–120 мс) */
const WHEEL_PULSE_MS = 120
const MIN_UNIT = 24
const MAX_UNIT = 72

const TOTAL_UNITS =
  keyboardLayout.width + KEYBOARD_PADDING * 2 + DEVICE_GAP + mouseLayout.width + MOUSE_PADDING

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
  // В 3D ближний край крупнее из-за перспективы — оставляем запас
  const fit = view === '3d' ? 0.9 : 0.98
  const unit = Math.min(MAX_UNIT, Math.max(MIN_UNIT, (width * fit) / TOTAL_UNITS))

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
      className="device-scene relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden bg-(--stage) select-none"
      data-view={view}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="device-plane flex items-start" style={{ gap: DEVICE_GAP * unit }}>
        <Keyboard
          layout={keyboardLayout}
          unit={unit}
          labelLang={labelLang}
          selected={selected}
          pressed={pressed}
          onSelect={onSelect}
        />
        <Mouse
          layout={mouseLayout}
          unit={unit}
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
