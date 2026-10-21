import { aulaF75 } from '@/layouts/aula-f75'
import { mouse2Side } from '@/layouts/mouse'
import { planInputs } from '@/domain/selection'

/** Устройства, которые показывает приложение. Выбор модели появится позже. */
export const keyboardLayout = aulaF75
export const mouseLayout = mouse2Side

/** Выделяемые клавиши и кнопки мыши на общем плане (FR-13) */
export const selectableInputs = planInputs(keyboardLayout, mouseLayout)

const keyboardCodes = new Set(keyboardLayout.keys.map((k) => k.code))

export function isKeyboardCode(code: string): boolean {
  return keyboardCodes.has(code)
}
