import {
  boundsOf,
  makeCamera,
  project,
  roundedRect,
  scaleAt,
  type Bounds,
  type Vec,
} from '@/components/devices/projection'
import type { ViewMode } from '@/features/devices/store'
import {
  mouseOutline,
  type MouseInputCode,
  type MouseInputDef,
  type MouseLayout,
} from '@/layouts/mouse'
import { ru } from '@/i18n/ru'
import { deviceTheme } from '@/styles/device-theme'

const { mouse: theme, view3d, legend } = deviceTheme

/** Выноска уходит за корпус на столько, в юнитах */
const CALLOUT_REACH = 0.4
/** Зазор между концом выноски и подписью, в юнитах */
export const CALLOUT_GAP = 0.08
/** Размер шрифта подписи, в юнитах */
export const CALLOUT_SIZE = legend.sizeShift
/** Средняя ширина символа в долях размера шрифта — для оценки места под подпись */
const CHAR_WIDTH = 0.52

export interface Callout {
  code: MouseInputCode
  text: string
  /** Начало выноски на мыши и её конец за корпусом */
  from: Vec
  to: Vec
  /** С какой стороны подпись */
  side: 'left' | 'right'
}

/** Сколько полосок на колесе */
const WHEEL_TREADS = 6
/** Полоска колеса короче его ширины — доля ширины */
const TREAD_WIDTH = 0.6

export interface MouseScene {
  /** Границы рисунка */
  box: Bounds
  outline: Vec[]
  sides: Vec[][]
  wheel: Vec[]
  treads: [Vec, Vec][]
  seams: [Vec, Vec][]
  /** Части кнопок до линии раздела — для нажатия и выделения */
  buttons: { code: MouseInputCode; area: Vec[] }[]
  /** Зоны клика */
  zones: { input: MouseInputDef; box: Bounds }[]
  /** Подписи боковых кнопок слева, колеса — справа */
  callouts: Callout[]
  /** Блик для радиального градиента в 3D */
  highlight: { center: Vec; radius: number }
}

function rect(x: number, y: number, w: number, h: number): Vec[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ]
}

/**
 * Мышь в 2D — как в раскладке; в 3D каждая точка проецируется с наклоном
 * view3d.mouseRotateX и перспективой view3d.mousePerspectivePx, как на превью.
 */
export function mouseScene(layout: MouseLayout, view: ViewMode): MouseScene {
  const { width, height } = layout
  const cam = makeCamera(view3d.mousePerspectivePx / deviceTheme.unitPx, view3d.mouseRotateX, {
    x: width / 2,
    y: height / 2,
  })
  const map = view === '3d' ? (p: Vec) => project(cam, p.x, p.y) : (p: Vec) => p
  const mapAll = (pts: Vec[]) => pts.map(map)

  const splitY = height * theme.buttonSplit
  const ws = theme.wheelSize
  const wx = (width - ws.w) / 2
  const outline = mapAll(mouseOutline(width, height, theme.shape))
  const sides = layout.inputs
    .filter((i) => i.kind === 'side')
    .map((s) => mapAll(roundedRect(s.x, s.y, s.w, s.h, s.w / 2)))
  const wheel = mapAll(roundedRect(wx, ws.y, ws.w, ws.h, ws.w / 2))
  const treadHalf = (ws.w * TREAD_WIDTH) / 2
  const treads = Array.from({ length: WHEEL_TREADS }, (_, i): [Vec, Vec] => {
    const y = ws.y + (ws.h * (i + 1)) / (WHEEL_TREADS + 1)
    return [map({ x: width / 2 - treadHalf, y }), map({ x: width / 2 + treadHalf, y })]
  })
  const seams: [Vec, Vec][] = [
    [map({ x: 0, y: splitY }), map({ x: width, y: splitY })],
    [map({ x: width / 2, y: 0 }), map({ x: width / 2, y: splitY })],
  ]
  const buttons = layout.inputs
    .filter((i) => i.kind === 'button')
    .map((b) => ({ code: b.code, area: mapAll(rect(b.x, b.y, b.w, splitY - b.y)) }))
  const zones = layout.inputs.map((input) => {
    const h = input.kind === 'button' ? splitY - input.y : input.h
    return { input, box: boundsOf(mapAll(rect(input.x, input.y, input.w, h))) }
  })
  const texts: Partial<Record<MouseInputCode, string>> = ru.devices.mouseCallouts
  const callouts = layout.inputs.flatMap((input): Callout[] => {
    const text = texts[input.code]
    if (!text) return []
    const y = input.y + input.h / 2
    const side = input.kind === 'side' ? 'left' : 'right'
    const from = { x: side === 'left' ? input.x : input.x + input.w, y }
    const to = { x: side === 'left' ? -CALLOUT_REACH : width + CALLOUT_REACH, y }
    return [{ code: input.code, text, from: map(from), to: map(to), side }]
  })
  // Место под подписи: оценка по числу символов
  const labelCorners = callouts.flatMap((c) => {
    const w = CALLOUT_GAP + c.text.length * CALLOUT_SIZE * CHAR_WIDTH
    const x = c.side === 'left' ? c.to.x - w : c.to.x + w
    return [
      { x, y: c.to.y - CALLOUT_SIZE / 2 },
      { x, y: c.to.y + CALLOUT_SIZE / 2 },
    ]
  })
  const hl = theme.shading.highlight
  const hy = height * hl.y
  const highlight = {
    center: map({ x: width * hl.x, y: hy }),
    radius: height * hl.radius * (view === '3d' ? scaleAt(cam, hy) : 1),
  }

  return {
    box: boundsOf([...outline, ...sides.flat(), ...labelCorners]),
    outline,
    sides,
    wheel,
    treads,
    seams,
    buttons,
    zones,
    callouts,
    highlight,
  }
}
