import { aulaF75 } from '@/layouts/aula-f75'
import { mouse2Side } from '@/layouts/mouse'
import { planInputs } from '@/domain/selection'

/** Устройства, которые показывает приложение. Выбор модели появится позже. */
export const keyboardLayout = aulaF75
export const mouseLayout = mouse2Side

/**
 * Для стрелок ЛКМ, Mouse 5 и Mouse 4 стоят как клавиши в рядах F12, Delete
 * и PgUp: ← и → переходят между ними и этими клавишами, ↑ и ↓ — друг между
 * другом (FR-03, FR-13).
 */
export const MOUSE_ROW_KEYS = { MouseLeft: 'F12', Mouse5: 'Delete', Mouse4: 'PageUp' }

/** Выделяемые клавиши и кнопки мыши на общем плане (FR-13) */
export const selectableInputs = planInputs(keyboardLayout, mouseLayout, MOUSE_ROW_KEYS)

const keyboardCodes = new Set(keyboardLayout.keys.map((k) => k.code))

export function isKeyboardCode(code: string): boolean {
  return keyboardCodes.has(code)
}
