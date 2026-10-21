/**
 * Состояние устройств: выделение, нажатые клавиши, режимы ввода и вида.
 * Логика выделения — в src/domain/selection, здесь только хранение.
 */

import { create } from 'zustand'
import type { LabelLang } from '@/domain/input'
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
import { keyboardLayout } from './devices'

/** «Проверка нажатий» или «Навигация» (ТЗ, FR-03) */
export type InputMode = 'check' | 'nav'
export type ViewMode = '3d' | '2d'

interface DevicesData {
  selection: SelectionState
  /** Входы, которые сейчас зажаты на настоящей клавиатуре или мыши */
  pressed: readonly InputCode[]
  inputMode: InputMode
  labelLang: LabelLang
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
  setLabelLang: (lang: LabelLang) => void
  setView: (view: ViewMode) => void
}

export type DevicesState = DevicesData & DevicesActions

export const initialDevicesData: DevicesData = {
  selection: emptySelection,
  pressed: [],
  inputMode: 'check',
  labelLang: 'en',
  view: '3d',
}

export const useDevicesStore = create<DevicesState>()((set) => ({
  ...initialDevicesData,

  click: (code, mods) => {
    set((s) => ({ selection: clickSelect(s.selection, code, mods, keyboardLayout) }))
  },
  selectOnly: (code) => {
    set((s) => ({
      selection: clickSelect(s.selection, code, { ctrl: false, shift: false }, keyboardLayout),
    }))
  },
  setSelection: (selection) => {
    set({ selection })
  },
  clearSelection: () => {
    set({ selection: emptySelection })
  },
  navigate: (dir, extend) => {
    set((s) => ({ selection: navigate(s.selection, dir, extend, keyboardLayout) }))
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
  setView: (view) => {
    set({ view })
  },
}))
