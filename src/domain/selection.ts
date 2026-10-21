/**
 * Выделение клавиш и кнопок мыши «как в проводнике» (ТЗ, FR-03, FR-13).
 *
 * Все функции чистые: принимают текущее состояние и раскладку, возвращают
 * новое состояние. Код входа — KeyboardEvent.code для клавиш или
 * MouseInputCode для мыши.
 */

import type { KeyboardLayout, KeyDef } from '@/layouts/aula-f75'
import type { MouseLayout } from '@/layouts/mouse'
import { center, containsPoint, EPSILON, intersects, rectFromPoints, type Rect } from './geometry'

export type InputCode = string

/**
 * Вход, который можно выделить: клавиша или кнопка мыши с прямоугольником
 * на общем плане в юнитах (мышь — справа от клавиатуры). По этому плану
 * считаются диапазоны Shift+клика и соседи для стрелок.
 */
export interface SelectableInput extends Rect {
  code: InputCode
  /**
   * Входы одной группы попадают в диапазон вместе: если прямоугольник
   * диапазона задевает любой из них, выделяются все. Так колесо мыши
   * (вверх, нажатие, вниз) выделяется целиком.
   */
  group?: string
  /**
   * В диапазон по пересечению, а не по центру: кнопки мыши крупные и разной
   * формы, и прямоугольник между центрами может их не накрыть
   * (Mouse 5 → ЛКМ → колесо потеряло бы ЛКМ).
   */
  byOverlap?: boolean
}

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

/** Клавиши, которые можно выделить (Fn, Win и регулятор — нельзя) */
export function selectableKeys(layout: KeyboardLayout): KeyDef[] {
  return layout.keys.filter((k) => k.assignable)
}

/** Зазор между клавиатурой и мышью на общем плане, в юнитах */
export const PLAN_GAP = 1

/**
 * Все выделяемые входы на общем плане: клавиши (кроме неназначаемых) и
 * кнопки мыши справа от клавиатуры, верхние края на одной высоте.
 */
export function planInputs(keyboard: KeyboardLayout, mouse: MouseLayout): SelectableInput[] {
  const sidePad = Math.max(0, ...mouse.inputs.map((i) => -i.x))
  const dx = keyboard.width + PLAN_GAP + sidePad
  return [
    ...selectableKeys(keyboard),
    ...mouse.inputs.map((i) => ({
      code: i.code,
      x: i.x + dx,
      y: i.y,
      w: i.w,
      h: i.h,
      byOverlap: true,
      // Прокрутка и нажатие колеса — одна группа
      ...(i.kind === 'wheel' || i.kind === 'scroll' ? { group: 'wheel' } : {}),
    })),
  ]
}

function find(
  inputs: readonly SelectableInput[],
  code: InputCode | null,
): SelectableInput | undefined {
  if (code === null) return undefined
  return inputs.find((i) => i.code === code)
}

/** Перекрытие отрезков [a, a+aw] и [b, b+bw] ненулевой длины */
function overlaps(a: number, aw: number, b: number, bw: number): boolean {
  return Math.min(a + aw, b + bw) - Math.max(a, b) > EPSILON
}

/** Объединение без повторов, порядок сохраняется */
function union(a: readonly InputCode[], b: readonly InputCode[]): InputCode[] {
  return [...new Set([...a, ...b])]
}

function single(code: InputCode): SelectionState {
  return { selected: [code], anchor: code, focus: code }
}

/**
 * Диапазон прямоугольником: от центра входа `from` до центра `to`.
 * Выделяются клавиши и кнопки мыши, центр которых попадает в прямоугольник
 * (Q → D даёт Q W E A S D).
 */
export function rangeSelect(
  inputs: readonly SelectableInput[],
  from: InputCode,
  to: InputCode,
): InputCode[] {
  const a = find(inputs, from)
  const b = find(inputs, to)
  if (!a || !b) return []
  const area = rectFromPoints(center(a), center(b))
  const inRange = (i: SelectableInput) =>
    containsPoint(area, center(i)) || (i.byOverlap === true && intersects(i, area))
  const groups = new Set(
    inputs.filter((i) => i.group !== undefined && inRange(i)).map((i) => i.group),
  )
  return inputs
    .filter((i) => inRange(i) || (i.group !== undefined && groups.has(i.group)))
    .map((i) => i.code)
}

/**
 * Клик по клавише или кнопке мыши.
 * - без модификаторов — выделить один вход;
 * - Ctrl — добавить или убрать вход;
 * - Shift — диапазон от якоря до входа, в том числе через клавиатуру и мышь;
 * - Ctrl+Shift — добавить диапазон к выделению.
 * Входов не из списка (Fn, Win, регулятор) клик не выделяет.
 */
export function clickSelect(
  state: SelectionState,
  code: InputCode,
  mods: ClickModifiers,
  inputs: readonly SelectableInput[],
): SelectionState {
  if (!find(inputs, code)) return state

  if (mods.shift && state.anchor !== null && find(inputs, state.anchor)) {
    const range = rangeSelect(inputs, state.anchor, code)
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
 * Соседний вход по общему плану.
 * ←/→ — ближайший по горизонтали среди входов, перекрывающихся по высоте
 * (для клавиш — тот же ряд; с правого края клавиатуры — на мышь);
 * ↑/↓ — в ближайшем ряду среди входов, перекрывающихся по ширине, с самым
 * близким центром по горизонтали. На краю возвращает сам вход.
 */
export function neighbor(
  inputs: readonly SelectableInput[],
  code: InputCode,
  dir: Direction,
): InputCode {
  const from = find(inputs, code)
  if (!from) return code
  const origin = center(from)

  const candidates = inputs
    .filter((i) => i.code !== code)
    .map((i) => {
      const c = center(i)
      return { input: i, dx: c.x - origin.x, dy: c.y - origin.y }
    })

  if (dir === 'left' || dir === 'right') {
    const sign = dir === 'right' ? 1 : -1
    const sameRow = candidates.filter(
      (c) => c.dx * sign > EPSILON && overlaps(from.y, from.h, c.input.y, c.input.h),
    )
    sameRow.sort((a, b) => Math.abs(a.dx) - Math.abs(b.dx) || Math.abs(a.dy) - Math.abs(b.dy))
    return sameRow[0]?.input.code ?? code
  }

  const sign = dir === 'down' ? 1 : -1
  const ahead = candidates.filter(
    (c) => c.dy * sign > EPSILON && overlaps(from.x, from.w, c.input.x, c.input.w),
  )
  // Сначала ближайший ряд, в нём — ближайший по X вход, при равенстве — левый
  ahead.sort(
    (a, b) => Math.abs(a.dy) - Math.abs(b.dy) || Math.abs(a.dx) - Math.abs(b.dx) || a.dx - b.dx,
  )
  return ahead[0]?.input.code ?? code
}

/**
 * Навигация стрелками (режим «Навигация»).
 * Стрелка переносит выделение на соседа, Shift+стрелка расширяет
 * выделение прямоугольником от якоря. Если ничего не выбрано —
 * выделяется первый вход.
 */
export function navigate(
  state: SelectionState,
  dir: Direction,
  extend: boolean,
  inputs: readonly SelectableInput[],
): SelectionState {
  const start = find(inputs, state.focus)
  if (!start) {
    const first = inputs[0]
    return first ? single(first.code) : state
  }

  const next = neighbor(inputs, start.code, dir)
  if (!extend) return single(next)

  const anchor = find(inputs, state.anchor)?.code ?? start.code
  return { selected: rangeSelect(inputs, anchor, next), anchor, focus: next }
}

/** Ctrl+A в режиме «Навигация»: все занятые клавиши текущего слоя */
export function selectAll(occupied: readonly InputCode[]): SelectionState {
  const first = occupied[0] ?? null
  return { selected: [...occupied], anchor: first, focus: first }
}
