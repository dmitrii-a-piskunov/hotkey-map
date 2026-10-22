import { aulaF75 } from '@/layouts/aula-f75'
import { mouse2Side } from '@/layouts/mouse'
import { planInputs } from '@/domain/selection'

/** Устройства, которые показывает приложение. Выбор модели появится позже. */
export const keyboardLayout = aulaF75
export const mouseLayout = mouse2Side

/**
 * Мышь — продолжение клавиатуры справа: ЛКМ, колесо и ПКМ стоят в ряду F12,
 * Mouse 5 — в ряду Delete, Mouse 4 — в ряду PgUp. По этим рядам ходят
 * стрелки и строятся диапазоны (FR-03, FR-13).
 */
export const MOUSE_ROWS = {
  MouseLeft: 'F12',
  WheelUp: 'F12',
  MouseMiddle: 'F12',
  WheelDown: 'F12',
  MouseRight: 'F12',
  Mouse5: 'Delete',
  Mouse4: 'PageUp',
}

/** Выделяемые клавиши и кнопки мыши на общем плане (FR-13) */
export const selectableInputs = planInputs(keyboardLayout, mouseLayout, MOUSE_ROWS)

const keyboardCodes = new Set(keyboardLayout.keys.map((k) => k.code))

export function isKeyboardCode(code: string): boolean {
  return keyboardCodes.has(code)
}
