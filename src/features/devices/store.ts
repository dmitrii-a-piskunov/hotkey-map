/**
 * Состояние устройств: выделение, нажатые клавиши, режимы ввода и вида.
 * Логика выделения — в src/domain/selection, здесь только хранение.
 */

import { create } from 'zustand'
import type { LabelMode } from '@/domain/input'
import {
  clickSelect,
  emptySelection,
  navigate,
  selectAll,
  type ClickModifiers,
  type Direction,
  type InputCode,
  type SelectionState,
} from '@/domain/selection'
import { selectableInputs } from './devices'

/** «Проверка нажатий» или «Навигация» (ТЗ, FR-03) */
export type InputMode = 'check' | 'nav'
export type ViewMode = '3d' | '2d'

interface DevicesData {
  selection: SelectionState
  /** Входы, которые сейчас зажаты на настоящей клавиатуре или мыши */
  pressed: readonly InputCode[]
  inputMode: InputMode
  /** Режим подписей: EN/RU, EN или RU (FR-04) */
  labelLang: LabelMode
  /** В режимах EN и RU переключать раскладку по последней нажатой клавише */
  autoLang: boolean
  view: ViewMode
}

interface DevicesActions {
  click: (code: InputCode, mods: ClickModifiers) => void
  selectOnly: (code: InputCode) => void
  setSelection: (selection: SelectionState) => void
  clearSelection: () => void
  navigate: (dir: Direction, extend: boolean) => void
  selectAllOccupied: () => void
  press: (code: InputCode) => void
  release: (code: InputCode) => void
  releaseAll: () => void
  setInputMode: (mode: InputMode) => void
  setLabelLang: (mode: LabelMode) => void
  setAutoLang: (auto: boolean) => void
  setView: (view: ViewMode) => void
}

export type DevicesState = DevicesData & DevicesActions

export const initialDevicesData: DevicesData = {
  selection: emptySelection,
  pressed: [],
  inputMode: 'check',
  labelLang: 'enru',
  autoLang: true,
  view: '3d',
}

export const useDevicesStore = create<DevicesState>()((set) => ({
  ...initialDevicesData,

  click: (code, mods) => {
    set((s) => ({ selection: clickSelect(s.selection, code, mods, selectableInputs) }))
  },
  selectOnly: (code) => {
    set((s) => ({
      selection: clickSelect(s.selection, code, { ctrl: false, shift: false }, selectableInputs),
    }))
  },
  setSelection: (selection) => {
    set({ selection })
  },
  clearSelection: () => {
    set({ selection: emptySelection })
  },
  navigate: (dir, extend) => {
    set((s) => ({ selection: navigate(s.selection, dir, extend, selectableInputs) }))
  },
  selectAllOccupied: () => {
    // Биндов пока нет (этап 4), поэтому занятых клавиш нет
    set({ selection: selectAll([]) })
  },
  press: (code) => {
    set((s) => (s.pressed.includes(code) ? s : { pressed: [...s.pressed, code] }))
  },
  release: (code) => {
    set((s) => (s.pressed.includes(code) ? { pressed: s.pressed.filter((c) => c !== code) } : s))
  },
  releaseAll: () => {
    set({ pressed: [] })
  },
  setInputMode: (inputMode) => {
    set({ inputMode, pressed: [] })
  },
  setLabelLang: (labelLang) => {
    set({ labelLang })
  },
  setAutoLang: (autoLang) => {
    set({ autoLang })
  },
  setView: (view) => {
    set({ view })
  },
}))
