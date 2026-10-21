/**
 * Выделение клавиш и кнопок мыши «как в проводнике» (ТЗ, FR-03, FR-13).
 *
 * Все функции чистые: принимают текущее состояние и раскладку, возвращают
 * новое состояние. Код входа — KeyboardEvent.code для клавиш или
 * MouseInputCode для мыши.
 */

import type { KeyboardLayout, KeyDef } from '@/layouts/aula-f75'
import { center, containsPoint, EPSILON, intersects, rectFromPoints, type Rect } from './geometry'

export type InputCode = string

export interface SelectionState {
  /** Выделенные входы в порядке выделения */
  selected: readonly InputCode[]
  /** Опорная точка для Shift+клика и Shift+стрелок — последняя кликнутая клавиша */
  anchor: InputCode | null
  /** Текущая позиция для навигации стрелками */
  focus: InputCode | null
}

export const emptySelection: SelectionState = { selected: [], anchor: null, focus: null }

export interface ClickModifiers {
  ctrl: boolean
  shift: boolean
}

export type Direction = 'up' | 'down' | 'left' | 'right'

/** Клавиши, которые можно выделить (Fn и регулятор — нельзя) */
export function selectableKeys(layout: KeyboardLayout): KeyDef[] {
  return layout.keys.filter((k) => k.assignable)
}

function findSelectableKey(layout: KeyboardLayout, code: InputCode | null): KeyDef | undefined {
  if (code === null) return undefined
  return layout.keys.find((k) => k.code === code && k.assignable)
}

function isUnselectableKey(layout: KeyboardLayout, code: InputCode): boolean {
  return layout.keys.some((k) => k.code === code && !k.assignable)
}

/** Объединение без повторов, порядок сохраняется */
function union(a: readonly InputCode[], b: readonly InputCode[]): InputCode[] {
  return [...new Set([...a, ...b])]
}

function single(code: InputCode): SelectionState {
  return { selected: [code], anchor: code, focus: code }
}

/**
 * Диапазон прямоугольником: от центра клавиши `from` до центра `to`.
 * Выделяются клавиши, центр которых попадает в прямоугольник
 * (Q → D даёт Q W E A S D).
 */
export function rangeSelect(layout: KeyboardLayout, from: InputCode, to: InputCode): InputCode[] {
  const a = findSelectableKey(layout, from)
  const b = findSelectableKey(layout, to)
  if (!a || !b) return []
  const area = rectFromPoints(center(a), center(b))
  return selectableKeys(layout)
    .filter((k) => containsPoint(area, center(k)))
    .map((k) => k.code)
}

/**
 * Клик по клавише или кнопке мыши.
 * - без модификаторов — выделить один вход;
 * - Ctrl — добавить или убрать вход;
 * - Shift — диапазон от якоря до клавиши (только для клавиатуры);
 * - Ctrl+Shift — добавить диапазон к выделению.
 */
export function clickSelect(
  state: SelectionState,
  code: InputCode,
  mods: ClickModifiers,
  layout: KeyboardLayout,
): SelectionState {
  if (isUnselectableKey(layout, code)) return state

  const isKey = findSelectableKey(layout, code) !== undefined
  const anchorIsKey = findSelectableKey(layout, state.anchor) !== undefined

  if (mods.shift && isKey && anchorIsKey && state.anchor !== null) {
    const range = rangeSelect(layout, state.anchor, code)
    return {
      selected: mods.ctrl ? union(state.selected, range) : range,
      anchor: state.anchor,
      focus: code,
    }
  }

  if (mods.ctrl) {
    const selected = state.selected.includes(code)
      ? state.selected.filter((c) => c !== code)
      : [...state.selected, code]
    return { selected, anchor: code, focus: code }
  }

  return single(code)
}

export interface HitBox {
  code: InputCode
  rect: Rect
}

/** Входы, чей прямоугольник пересекает рамку */
export function rectSelect(items: readonly HitBox[], area: Rect): InputCode[] {
  return items.filter((item) => intersects(item.rect, area)).map((item) => item.code)
}

/**
 * Выделение рамкой. `base` — выделение на момент начала рамки:
 * с Ctrl рамка добавляет к нему, без Ctrl — заменяет.
 */
export function marqueeSelect(
  base: SelectionState,
  hits: readonly InputCode[],
  additive: boolean,
): SelectionState {
  if (additive) return { ...base, selected: union(base.selected, hits) }
  const first = hits[0] ?? null
  return { selected: [...hits], anchor: first, focus: first }
}

/**
 * Соседняя клавиша по экрану.
 * ←/→ — ближайшая в том же ряду; ↑/↓ — в ближайшем ряду, с самым близким
 * центром по горизонтали. На краю возвращает саму клавишу.
 */
export function neighbor(layout: KeyboardLayout, code: InputCode, dir: Direction): InputCode {
  const from = findSelectableKey(layout, code)
  if (!from) return code
  const origin = center(from)

  const candidates = selectableKeys(layout)
    .filter((k) => k.code !== code)
    .map((k) => {
      const c = center(k)
      return { code: k.code, dx: c.x - origin.x, dy: c.y - origin.y }
    })

  if (dir === 'left' || dir === 'right') {
    const sign = dir === 'right' ? 1 : -1
    const sameRow = candidates.filter((c) => Math.abs(c.dy) < EPSILON && c.dx * sign > EPSILON)
    sameRow.sort((a, b) => Math.abs(a.dx) - Math.abs(b.dx))
    return sameRow[0]?.code ?? code
  }

  const sign = dir === 'down' ? 1 : -1
  const ahead = candidates.filter((c) => c.dy * sign > EPSILON)
  // Сначала ближайший ряд, в нём — ближайшая по X клавиша, при равенстве — левая
  ahead.sort(
    (a, b) => Math.abs(a.dy) - Math.abs(b.dy) || Math.abs(a.dx) - Math.abs(b.dx) || a.dx - b.dx,
  )
  return ahead[0]?.code ?? code
}

/**
 * Навигация стрелками (режим «Навигация»).
 * Стрелка переносит выделение на соседа, Shift+стрелка расширяет
 * выделение прямоугольником от якоря. Если клавиша не выбрана —
 * выделяется первая клавиша раскладки.
 */
export function navigate(
  state: SelectionState,
  dir: Direction,
  extend: boolean,
  layout: KeyboardLayout,
): SelectionState {
  const start = findSelectableKey(layout, state.focus)
  if (!start) {
    const first = selectableKeys(layout)[0]
    return first ? single(first.code) : state
  }

  const next = neighbor(layout, start.code, dir)
  if (!extend) return single(next)

  const anchor = findSelectableKey(layout, state.anchor)?.code ?? start.code
  return { selected: rangeSelect(layout, anchor, next), anchor, focus: next }
}

/** Ctrl+A в режиме «Навигация»: все занятые клавиши текущего слоя */
export function selectAll(occupied: readonly InputCode[]): SelectionState {
  const first = occupied[0] ?? null
  return { selected: [...occupied], anchor: first, focus: first }
}
