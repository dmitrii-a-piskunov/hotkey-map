/**
 * Состояние устройств: выделение и нажатые клавиши. Живёт только в сессии;
 * режимы ввода, подписей и вида — в appSettings (src/features/data/store).
 * Логика выделения — в src/domain/selection, здесь только хранение.
 */

import { create } from 'zustand'
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

interface DevicesData {
  selection: SelectionState
  /** Входы, которые сейчас зажаты на настоящей клавиатуре или мыши */
  pressed: readonly InputCode[]
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
}

export type DevicesState = DevicesData & DevicesActions

export const initialDevicesData: DevicesData = {
  selection: emptySelection,
  pressed: [],
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
}))
