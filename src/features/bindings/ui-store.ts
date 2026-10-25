/**
 * Сессионное состояние биндов: слой, захват клавиши, отклик под кнопкой,
 * подсветка от поиска и вкладка панели. В data.json не попадает.
 */

import { create } from 'zustand'
import { BASE_LAYER } from '@/domain/layers'
import type { BindingInput } from '@/domain/types'

/** Кнопка клавиши: слот действия */
export interface SlotRef {
  actionId: string
  slot: 1 | 2
}

/**
 * Окно «Привязка клавиши» (FR-12): слот и новая клавиша. pending не задан —
 * клавишу ещё не нажали; null — «Очистить»
 */
export interface Capture extends SlotRef {
  pending?: BindingInput | null
}

export type PanelTab = 'actions' | 'unbound' | 'groups' | 'settings' | 'notes'

/** Подсветка клавиш действия при наведении или клике в списке (FR-16) */
export interface Highlight {
  actionId: string
  codes: string[]
  /** Клик закрепляет подсветку, наведение — пока указатель над строкой */
  pinned: boolean
}

interface BindingsUi {
  /** Слой модификаторов над клавиатурой (FR-14) */
  layer: string
  /** Открытое окно привязки */
  capture: Capture | null
  highlight: Highlight | null
  tab: PanelTab
}

export const useBindingsUi = create<BindingsUi>()(() => ({
  layer: BASE_LAYER,
  capture: null,
  highlight: null,
  tab: 'actions',
}))

export function setLayer(layer: string): void {
  useBindingsUi.setState((s) => (s.layer === layer ? s : { layer }))
}

export function startCapture(ref: SlotRef): void {
  useBindingsUi.setState({ capture: { actionId: ref.actionId, slot: ref.slot } })
}

export function setPending(pending: BindingInput | null): void {
  useBindingsUi.setState((s) => (s.capture ? { capture: { ...s.capture, pending } } : s))
}

export function cancelCapture(): void {
  useBindingsUi.setState((s) => (s.capture ? { capture: null } : s))
}

export function isCapturing(): boolean {
  return useBindingsUi.getState().capture !== null
}

export function setHighlight(highlight: Highlight | null): void {
  useBindingsUi.setState({ highlight })
}

export function setPanelTab(tab: PanelTab): void {
  useBindingsUi.setState({ tab })
}

/** Сброс при смене игры или профиля: захват и отклик относятся к старым действиям */
export function resetBindingsUi(): void {
  useBindingsUi.setState({ capture: null, highlight: null })
}
