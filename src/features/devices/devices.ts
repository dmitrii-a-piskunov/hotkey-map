import { aulaF75 } from '@/layouts/aula-f75'
import { mouse2Side } from '@/layouts/mouse'

/** Устройства, которые показывает приложение. Выбор модели появится позже. */
export const keyboardLayout = aulaF75
export const mouseLayout = mouse2Side

const keyboardCodes = new Set(keyboardLayout.keys.map((k) => k.code))

export function isKeyboardCode(code: string): boolean {
  return keyboardCodes.has(code)
}
