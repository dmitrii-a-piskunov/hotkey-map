import {
  boundsOf,
  clipPolygon,
  makeCamera,
  project,
  roundedRect,
  scaleAt,
  type Bounds,
  type Vec,
} from '@/components/devices/projection'
import type { ViewMode } from '@/domain/types'
import {
  mouseOutline,
  type MouseInputCode,
  type MouseInputDef,
  type MouseLayout,
} from '@/layouts/mouse'
import { intersects } from '@/domain/geometry'
import { ru } from '@/i18n/ru'
import { deviceTheme } from '@/styles/device-theme'

const { mouse: theme, view3d, legend, state } = deviceTheme

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

/** Точек на дуге линии раздела кнопок */
const CURVE_SAMPLES = 32

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
  /**
   * Кнопки корпуса: область — часть силуэта до линии раздела; вырезы —
   * боковые кнопки с зазором, которые обводка выделения огибает
   */
  buttons: { code: MouseInputCode; region: Vec[]; notches: Vec[][] }[]
  /**
   * Зоны клика. У кнопок корпуса — ещё и контур (clip): зона обрезается по
   * дуге линии раздела, клик ниже дуги кнопку не нажимает
   */
  zones: { input: MouseInputDef; box: Bounds; clip?: Vec[] }[]
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
  // Линия раздела кнопок и корпуса: у боков — на splitY, в центре — глубже
  const { depth2d, depth3d } = theme.buttonCurve
  const depth = view === '3d' ? depth3d : depth2d
  const curveY = (x: number) => {
    const u = (x - width / 2) / (width / 2)
    return splitY + depth * Math.sqrt(Math.max(0, 1 - u * u))
  }
  const curve = (x0: number, x1: number) =>
    Array.from({ length: CURVE_SAMPLES + 1 }, (_, i) => {
      const x = x0 + ((x1 - x0) * i) / CURVE_SAMPLES
      return { x, y: curveY(x) }
    })
  const split = mapAll(curve(0, width))
  const seams: [Vec, Vec][] = [
    ...split.slice(1).map((p, i): [Vec, Vec] => [split[i] ?? p, p]),
    [map({ x: width / 2, y: 0 }), map({ x: width / 2, y: curveY(width / 2) })],
  ]
  const plainOutline = mouseOutline(width, height, theme.shape)
  // Зазор между обводкой кнопки и боковой кнопкой — толщина обводки
  const gap = state.selected.width
  const sideInputs = layout.inputs.filter((i) => i.kind === 'side')
  const buttons = layout.inputs
    .filter((i) => i.kind === 'button')
    .map((b) => {
      // Над дугой: верх кнопки и дуга справа налево — выпуклая фигура для отсечения
      const area = [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, ...curve(b.x + b.w, b.x)]
      const notches = sideInputs
        .filter((s) =>
          intersects(
            { x: s.x - gap, y: s.y - gap, w: s.w + gap * 2, h: s.h + gap * 2 },
            { x: b.x, y: b.y, w: b.w, h: curveY(b.x + b.w / 2) - b.y },
          ),
        )
        .map((s) =>
          mapAll(roundedRect(s.x - gap, s.y - gap, s.w + gap * 2, s.h + gap * 2, s.w / 2 + gap)),
        )
      return { code: b.code, region: mapAll(clipPolygon(plainOutline, area)), notches }
    })
  const zones = layout.inputs.map((input) => {
    const region = buttons.find((b) => b.code === input.code)?.region
    if (region) return { input, box: boundsOf(region), clip: region }
    return { input, box: boundsOf(mapAll(rect(input.x, input.y, input.w, input.h))) }
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
