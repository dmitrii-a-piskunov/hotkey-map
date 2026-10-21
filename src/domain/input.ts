/**
 * Разбор событий ввода (ТЗ, FR-03, FR-04). Чистые функции без DOM:
 * принимают только нужные поля событий.
 */

import type { MouseInputCode, MouseLayout } from '@/layouts/mouse'
import type { Direction } from './selection'

export interface KeyCombo {
  code: string
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
}

const MODIFIER_CODES = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
])

export function isModifierCode(code: string): boolean {
  return MODIFIER_CODES.has(code)
}

/** Ctrl+W, Ctrl+T, Ctrl+N забирает браузер — не мешаем ему */
const BROWSER_CTRL_CODES = new Set(['KeyW', 'KeyT', 'KeyN'])

/**
 * Комбинации, которые забирает браузер или Windows. Для них не вызываем
 * preventDefault, бинд на них назначается кликом по экранной клавиатуре.
 */
export function isReservedCombo(e: KeyCombo): boolean {
  if (e.metaKey || e.code === 'MetaLeft' || e.code === 'MetaRight') return true
  if (e.ctrlKey && BROWSER_CTRL_CODES.has(e.code)) return true
  if (e.altKey && e.code === 'F4') return true
  return false
}

const ARROWS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

export function arrowDirection(code: string): Direction | null {
  return ARROWS[code] ?? null
}

export type LabelLang = 'en' | 'ru'

/**
 * Язык по символу нажатой клавиши (KeyboardEvent.key):
 * кириллица — RU, латиница — EN, остальное язык не меняет.
 */
export function detectLabelLang(key: string): LabelLang | null {
  if (key.length !== 1) return null
  if (/[а-яё]/i.test(key)) return 'ru'
  if (/[a-z]/i.test(key)) return 'en'
  return null
}

/** Вход мыши по MouseEvent.button */
export function mouseCodeForButton(layout: MouseLayout, button: number): MouseInputCode | null {
  const input = layout.inputs.find((i) => 'button' in i.match && i.match.button === button)
  return input?.code ?? null
}

/** Вход мыши по направлению прокрутки (WheelEvent.deltaY) */
export function mouseCodeForWheel(layout: MouseLayout, deltaY: number): MouseInputCode | null {
  if (deltaY === 0) return null
  const dir = deltaY < 0 ? 'up' : 'down'
  const input = layout.inputs.find((i) => 'wheel' in i.match && i.match.wheel === dir)
  return input?.code ?? null
}
