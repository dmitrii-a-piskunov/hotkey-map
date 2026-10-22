/**
 * Выделение клавиш и кнопок мыши «как в проводнике» (ТЗ, FR-03, FR-13).
 *
 * Все функции чистые: принимают текущее состояние и раскладку, возвращают
 * новое состояние. Код входа — KeyboardEvent.code для клавиш или
 * MouseInputCode для мыши.
 *
 * Стрелки и диапазоны работают по логической сетке, как таблица: у каждого
 * входа есть ряд и столбцы. Сетку клавиатуры задаёт раскладка (navGrid,
 * столбцы буквенного блока — пальцевые зоны), мышь продолжает её справа.
 */

import { KNOB_CODE, type KeyboardLayout } from '@/layouts/aula-f75'
import type { MouseLayout } from '@/layouts/mouse'
import { center, EPSILON, intersects, type Rect } from './geometry'

export type InputCode = string

/**
 * Вход, который можно выделить: клавиша, регулятор или кнопка мыши.
 * Прямоугольник — на общем плане в юнитах (мышь справа от клавиатуры).
 */
export interface SelectableInput extends Rect {
  code: InputCode
  device: 'keyboard' | 'mouse'
  /** Ряд сетки сверху вниз (0 — ряд F) */
  line: number
  /** Первый и последний столбец сетки: широкая клавиша занимает несколько */
  cols: readonly [number, number]
  /**
   * Входы одной группы попадают в диапазон вместе: если прямоугольник
   * диапазона задевает любой из них, выделяются все. Так колесо мыши
   * (вверх, нажатие, вниз) выделяется целиком.
   */
  group?: string
  /**
   * Не передаётся в игру (Fn, регулятор, непередаваемые клавиши игры):
   * выделяется красным, бинд на
   * него не назначается, обычный клик выделение не меняет.
   */
  blocked?: boolean
}

export interface SelectionState {
  /** Выделенные входы в порядке выделения */
  selected: readonly InputCode[]
  /** Опорная точка для Shift+клика и Shift+стрелок — последняя кликнутая клавиша */
  anchor: InputCode | null
  /** Текущая позиция для навигации стрелками */
  focus: InputCode | null
  /**
   * Столбцы якоря и фокуса. ↑ и ↓ столбец не меняют, как в таблице: под
   * пробелом стрелка вверх возвращает в тот столбец, откуда пришли.
   * Нет поля — средний столбец входа.
   */
  anchorCol?: number
  focusCol?: number
}

export const emptySelection: SelectionState = { selected: [], anchor: null, focus: null }

export interface ClickModifiers {
  ctrl: boolean
  shift: boolean
}

export type Direction = 'up' | 'down' | 'left' | 'right'

/** Зазор между клавиатурой и мышью на общем плане, в юнитах */
export const PLAN_GAP = 1

interface Cell {
  line: number
  first: number
  last: number
}

/** Где в сетке стоит каждый код: ряд и столбцы подряд */
function gridCells(grid: KeyboardLayout['navGrid']): Map<InputCode, Cell> {
  const cells = new Map<InputCode, Cell>()
  grid.forEach((row, line) => {
    row.forEach((code, col) => {
      if (code === null) return
      const cell = cells.get(code)
      if (cell) cell.last = col
      else cells.set(code, { line, first: col, last: col })
    })
  })
  return cells
}

/**
 * Все выделяемые входы на общем плане: клавиши из сетки раскладки (неназначаемые
 * — с пометкой blocked), регулятор и кнопки мыши справа от клавиатуры.
 *
 * mouseRows ставит кнопку мыши в ряд клавиши: ЛКМ — в ряд F12, Mouse 5 — в
 * ряд Delete. Столбцы мыши идут за столбцами клавиатуры слева направо.
 */
export function planInputs(
  keyboard: KeyboardLayout,
  mouse: MouseLayout,
  mouseRows: Readonly<Partial<Record<InputCode, InputCode>>> = {},
): SelectableInput[] {
  const cells = gridCells(keyboard.navGrid)
  const gridWidth = Math.max(...keyboard.navGrid.map((row) => row.length))

  const keys = keyboard.keys.flatMap((k): SelectableInput[] => {
    const cell = cells.get(k.code)
    if (!cell) return []
    return [
      {
        code: k.code,
        device: 'keyboard',
        x: k.x,
        y: k.y,
        w: k.w,
        h: k.h,
        line: cell.line,
        cols: [cell.first, cell.last],
        ...(k.assignable ? {} : { blocked: true }),
      },
    ]
  })

  const knobCell = cells.get(KNOB_CODE)
  const knob = keyboard.knob
  const knobInput: SelectableInput[] =
    knob && knobCell
      ? [
          {
            code: KNOB_CODE,
            device: 'keyboard',
            x: knob.cx - knob.d / 2,
            y: knob.cy - knob.d / 2,
            w: knob.d,
            h: knob.d,
            line: knobCell.line,
            cols: [knobCell.first, knobCell.last],
            blocked: true,
          },
        ]
      : []

  const sidePad = Math.max(0, ...mouse.inputs.map((i) => -i.x))
  const dx = keyboard.width + PLAN_GAP + sidePad
  const mouseXs = [...new Set(mouse.inputs.map((i) => i.x))].sort((a, b) => a - b)
  const mouseInputs = mouse.inputs.map((i): SelectableInput => {
    const col = gridWidth + mouseXs.indexOf(i.x)
    const rowKey = mouseRows[i.code]
    return {
      code: i.code,
      device: 'mouse',
      x: i.x + dx,
      y: i.y,
      w: i.w,
      h: i.h,
      line: (rowKey === undefined ? undefined : cells.get(rowKey)?.line) ?? 0,
      cols: [col, col],
      // Прокрутка и нажатие колеса — одна группа
      ...(i.kind === 'wheel' || i.kind === 'scroll' ? { group: 'wheel' } : {}),
    }
  })

  return [...keys, ...knobInput, ...mouseInputs]
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

/** Средний столбец входа: им считается Shift+клик по широкой клавише */
function midCol(input: SelectableInput): number {
  return Math.floor((input.cols[0] + input.cols[1]) / 2)
}

/**
 * Диапазон прямоугольником в сетке: ряды от `from` до `to` и столбцы между
 * их столбцами (по умолчанию — средними). Выделяются входы, которые
 * задевают прямоугольник, в том числе непередаваемые: Q → D даёт
 * Q W E A S D, столбец среднего пальца от C вверх — C, D, E, 4.
 */
export function rangeSelect(
  inputs: readonly SelectableInput[],
  from: InputCode,
  to: InputCode,
  fromCol?: number,
  toCol?: number,
): InputCode[] {
  const a = find(inputs, from)
  const b = find(inputs, to)
  if (!a || !b) return []
  const ac = fromCol ?? midCol(a)
  const bc = toCol ?? midCol(b)
  const lo = Math.min(ac, bc)
  const hi = Math.max(ac, bc)
  const top = Math.min(a.line, b.line)
  const bottom = Math.max(a.line, b.line)
  const inRange = (i: SelectableInput) =>
    i === a || i === b || (i.line >= top && i.line <= bottom && i.cols[0] <= hi && i.cols[1] >= lo)
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
 * Непередаваемые клавиши обычным кликом не выделяются и не снимаются, Ctrl и
 * Shift работают с ними как с остальными.
 */
export function clickSelect(
  state: SelectionState,
  code: InputCode,
  mods: ClickModifiers,
  inputs: readonly SelectableInput[],
): SelectionState {
  const input = find(inputs, code)
  if (!input) return state

  if (mods.shift && state.anchor !== null && find(inputs, state.anchor)) {
    const range = rangeSelect(inputs, state.anchor, code, state.anchorCol)
    return {
      selected: mods.ctrl ? union(state.selected, range) : range,
      anchor: state.anchor,
      focus: code,
      ...(state.anchorCol === undefined ? {} : { anchorCol: state.anchorCol }),
    }
  }

  if (mods.ctrl) {
    const selected = state.selected.includes(code)
      ? state.selected.filter((c) => c !== code)
      : [...state.selected, code]
    return { selected, anchor: code, focus: code }
  }

  if (input.blocked) return state
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
 * Сосед по настоящим прямоугольникам на плане — для кнопок мыши и когда в
 * ряду сетки дальше ничего нет: ЛКМ ↓ Mouse 5 ↓ Mouse 4, переходы внутри
 * колеса, Mouse 5 → ЛКМ.
 * ←/→ — ближайший по горизонтали среди входов, перекрывающихся по высоте;
 * ↑/↓ — ближайший ряд среди перекрывающихся по ширине, в нём — ближайший
 * центр. На краю возвращает сам вход.
 */
function geometricNeighbor(
  inputs: readonly SelectableInput[],
  from: SelectableInput,
  dir: Direction,
): SelectableInput {
  const origin = center(from)
  const candidates = inputs
    .filter((i) => i !== from)
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
    return sameRow[0]?.input ?? from
  }

  const sign = dir === 'down' ? 1 : -1
  const ahead = candidates.filter(
    (c) => c.dy * sign > EPSILON && overlaps(from.x, from.w, c.input.x, c.input.w),
  )
  // Сначала ближайший ряд, в нём — ближайший по X вход, при равенстве — левый
  ahead.sort(
    (a, b) => Math.abs(a.dy) - Math.abs(b.dy) || Math.abs(a.dx) - Math.abs(b.dx) || a.dx - b.dx,
  )
  return ahead[0]?.input ?? from
}

/**
 * Из входов одной ячейки — средний по высоте. В ячейке колеса это нажатие
 * колеса, а не прокрутка: ЛКМ → СКМ, ПКМ ← СКМ.
 */
function middleOf(cell: readonly SelectableInput[]): SelectableInput | undefined {
  if (cell.length < 2) return cell[0]
  const mid = cell.reduce((sum, i) => sum + center(i).y, 0) / cell.length
  return [...cell].sort((a, b) => Math.abs(center(a).y - mid) - Math.abs(center(b).y - mid))[0]
}

interface Step {
  input: SelectableInput
  /** Столбец после шага */
  col: number
}

/**
 * Шаг стрелкой по сетке (FR-03, FR-13).
 * ←/→ — следующий вход того же ряда по столбцам; столбец — ближний край
 * нового входа (пробел с Alt → столбец C, с Fn → столбец Б). Справа от
 * клавиатуры ряд продолжает мышь: F12 → регулятор → ЛКМ, Delete → Mouse 5.
 * ↑/↓ — клавиша соседнего ряда в том же столбце, столбец не меняется; в
 * пустой ячейке — ближайшая по столбцам клавиша ряда.
 * Кнопки мыши по вертикали и концы рядов — по прямоугольникам на плане.
 */
function step(
  inputs: readonly SelectableInput[],
  from: SelectableInput,
  dir: Direction,
  col: number,
): Step {
  const origin = center(from)
  const fallback = (): Step => {
    const input = geometricNeighbor(inputs, from, dir)
    return { input, col: input === from ? col : midCol(input) }
  }

  if (dir === 'left' || dir === 'right') {
    const right = dir === 'right'
    const gap = (i: SelectableInput) =>
      right ? i.cols[0] - from.cols[1] : from.cols[0] - i.cols[1]
    const ahead = inputs.filter((i) => i.line === from.line && gap(i) > 0)
    const nearest = Math.min(...ahead.map(gap))
    const next = middleOf(ahead.filter((i) => gap(i) === nearest))
    if (!next) return fallback()
    return { input: next, col: right ? next.cols[0] : next.cols[1] }
  }

  if (from.device === 'mouse') return fallback()

  const line = from.line + (dir === 'down' ? 1 : -1)
  const distance = (i: SelectableInput) =>
    col < i.cols[0] ? i.cols[0] - col : col > i.cols[1] ? col - i.cols[1] : 0
  const byCenter = (a: SelectableInput, b: SelectableInput) =>
    Math.abs(center(a).x - origin.x) - Math.abs(center(b).x - origin.x)
  const next = inputs
    .filter((i) => i.line === line && i.device === 'keyboard')
    .sort((a, b) => distance(a) - distance(b) || byCenter(a, b))[0]
  return next ? { input: next, col } : { input: from, col }
}

function sameSet(a: readonly InputCode[], b: readonly InputCode[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((code) => set.has(code))
}

/**
 * Shift+←/→: шаг на один столбец сетки, а не на клавишу. Пальцевая зона из
 * двух столбцов (Н Р Т и Е П И) добавляется по столбцу за нажатие, а на
 * широкой клавише курсор остаётся, пока не дойдёт до её края: Shift в
 * столбцах 0–1, поэтому ← добавляет к 1, Tab, Caps только Ё, а ↓ с него
 * ведёт в тот же столбец нижнего ряда. Столбцы, которые ничего не меняют
 * (внутри пробела), проходятся за одно нажатие. За концом ряда — обычный
 * шаг (Mouse 5 → ЛКМ).
 */
function columnStep(
  inputs: readonly SelectableInput[],
  anchor: SelectableInput,
  anchorCol: number,
  from: SelectableInput,
  col: number,
  dir: 'left' | 'right',
): Step {
  const current = rangeSelect(inputs, anchor.code, from.code, anchorCol, col)
  const row = inputs.filter((i) => i.line === from.line)
  const sign = dir === 'right' ? 1 : -1
  const lastCol = Math.max(...row.map((i) => i.cols[1]))
  for (let c = col + sign; c >= 0 && c <= lastCol; c += sign) {
    const input = middleOf(row.filter((i) => i.cols[0] <= c && c <= i.cols[1]))
    if (!input) continue
    const range = rangeSelect(inputs, anchor.code, input.code, anchorCol, c)
    if (!sameSet(range, current)) return { input, col: c }
  }
  return step(inputs, from, dir, col)
}

/** Соседний вход для стрелки от среднего столбца входа. На краю — сам вход */
export function neighbor(
  inputs: readonly SelectableInput[],
  code: InputCode,
  dir: Direction,
): InputCode {
  const from = find(inputs, code)
  return from ? step(inputs, from, dir, midCol(from)).input.code : code
}

/**
 * Навигация стрелками (режим «Навигация»).
 * Стрелка переносит выделение на соседа, Shift+стрелка расширяет
 * выделение прямоугольником от якоря. Стрелки останавливаются и на
 * непередаваемых клавишах — они выделяются красным. Если ничего не выбрано —
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

  const focusCol = state.focusCol ?? midCol(start)
  if (!extend) {
    const next = step(inputs, start, dir, focusCol)
    return { ...single(next.input.code), anchorCol: next.col, focusCol: next.col }
  }

  const anchor = find(inputs, state.anchor) ?? start
  const anchorCol = state.anchorCol ?? (anchor === start ? focusCol : midCol(anchor))
  const next =
    dir === 'left' || dir === 'right'
      ? columnStep(inputs, anchor, anchorCol, start, focusCol, dir)
      : step(inputs, start, dir, focusCol)
  return {
    selected: rangeSelect(inputs, anchor.code, next.input.code, anchorCol, next.col),
    anchor: anchor.code,
    focus: next.input.code,
    anchorCol,
    focusCol: next.col,
  }
}

/** Ctrl+A в режиме «Навигация»: все занятые клавиши текущего слоя */
export function selectAll(occupied: readonly InputCode[]): SelectionState {
  const first = occupied[0] ?? null
  return { selected: [...occupied], anchor: first, focus: first }
}
