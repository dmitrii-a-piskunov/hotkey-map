/**
 * Названия клавиш, комбинаций и слоёв для интерфейса (FR-12, FR-14):
 * «Ctrl+1», «Shift+ЛКМ», «Без модификатора».
 */

import { layerModifiers } from '@/domain/bindings'
import type { BindingInput, KeyGroup, Modifier, PressType } from '@/domain/types'
import { keyboardLayout } from '@/features/devices/devices'
import { ru } from '@/i18n/ru'

const keyNames = new Map(
  keyboardLayout.keys.map((k) => [k.code, k.label.game?.en ?? (k.label.en || k.code)]),
)

export function modifierName(m: Modifier): string {
  return ru.bindings.modifiers[m]
}

/** Название клавиши или кнопки мыши без модификаторов */
export function inputName(code: string): string {
  if (code in ru.bindings.mouseNames) {
    return ru.bindings.mouseNames[code as keyof typeof ru.bindings.mouseNames]
  }
  if (code === 'Knob') return ru.devices.knob
  return keyNames.get(code) ?? code
}

/** Комбинация: «Ctrl+Shift+1» */
export function comboName(input: Pick<BindingInput, 'code' | 'modifiers'>): string {
  return [...input.modifiers.map(modifierName), inputName(input.code)].join('+')
}

/** Слой: «Без модификатора», «Ctrl», «Ctrl+Shift» */
export function layerName(key: string): string {
  const mods = layerModifiers(key)
  return mods.length === 0 ? ru.bindings.baseLayer : mods.map(modifierName).join('+')
}

export function pressTypeName(t: PressType): string {
  return ru.bindings.pressTypes[t]
}

/** Список «W (Движение), A (Движение)» для вопроса о переносе клавиш (FR-29) */
export function movedList(items: readonly { code: string; group: KeyGroup }[]): string {
  return items.map((i) => `${inputName(i.code)} (${i.group.name})`).join(', ')
}
