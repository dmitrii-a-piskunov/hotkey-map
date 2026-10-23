/**
 * Сессионное состояние биндов: слой, захват клавиши, отклик под кнопкой,
 * подсветка от поиска и вкладка панели. В data.json не попадает.
 */

import { create } from 'zustand'
import type { CaptureError } from '@/domain/bindings'
import { BASE_LAYER } from '@/domain/layers'

/** Кнопка клавиши: слот действия */
export interface SlotRef {
  actionId: string
  slot: 1 | 2
}

/** Что показать под кнопкой после захвата (FR-12, шаги 3 и 4) */
export type SlotFeedback =
  | (SlotRef & { kind: 'error'; error: CaptureError })
  | (SlotRef & { kind: 'conflict'; bindingId: string })
  | (SlotRef & { kind: 'noFreeSlot' })

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
  /** Кнопка в режиме «Нажмите клавишу…» */
  capture: SlotRef | null
  feedback: SlotFeedback | null
  highlight: Highlight | null
  tab: PanelTab
}

export const useBindingsUi = create<BindingsUi>()(() => ({
  layer: BASE_LAYER,
  capture: null,
  feedback: null,
  highlight: null,
  tab: 'actions',
}))

export function setLayer(layer: string): void {
  useBindingsUi.setState((s) => (s.layer === layer ? s : { layer }))
}

export function startCapture(ref: SlotRef): void {
  useBindingsUi.setState({ capture: ref, feedback: null })
}

export function cancelCapture(): void {
  useBindingsUi.setState((s) => (s.capture ? { capture: null } : s))
}

export function isCapturing(): boolean {
  return useBindingsUi.getState().capture !== null
}

export function setFeedback(feedback: SlotFeedback | null): void {
  useBindingsUi.setState({ feedback })
}

export function setHighlight(highlight: Highlight | null): void {
  useBindingsUi.setState({ highlight })
}

export function setPanelTab(tab: PanelTab): void {
  useBindingsUi.setState({ tab })
}

/** Сброс при смене игры или профиля: захват и отклик относятся к старым действиям */
export function resetBindingsUi(): void {
  useBindingsUi.setState({ capture: null, feedback: null, highlight: null })
}
