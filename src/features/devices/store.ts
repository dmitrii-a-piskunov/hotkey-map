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
import { currentGame, currentProfile } from '@/domain/current'
import { layerInputs } from '@/domain/layers'
import { useDataStore } from '@/features/data/store'
import { useBindingsUi } from '@/features/bindings/ui-store'
import { currentSelectableInputs } from './blocked-keys'

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
    set((s) => ({ selection: clickSelect(s.selection, code, mods, currentSelectableInputs()) }))
  },
  selectOnly: (code) => {
    set((s) => ({
      selection: clickSelect(
        s.selection,
        code,
        { ctrl: false, shift: false },
        currentSelectableInputs(),
      ),
    }))
  },
  setSelection: (selection) => {
    set({ selection })
  },
  clearSelection: () => {
    set({ selection: emptySelection })
  },
  navigate: (dir, extend) => {
    set((s) => ({ selection: navigate(s.selection, dir, extend, currentSelectableInputs()) }))
  },
  selectAllOccupied: () => {
    const { data } = useDataStore.getState()
    const game = currentGame(data)
    const profile = game && currentProfile(game, data.appSettings)
    // Непередаваемые клавиши Ctrl+A не выделяет (FR-01), даже если на них остался бинд
    const blocked = new Set(
      currentSelectableInputs()
        .filter((i) => i.blocked)
        .map((i) => i.code),
    )
    const occupied = layerInputs(profile, useBindingsUi.getState().layer)
    set({ selection: selectAll(occupied.filter((c) => !blocked.has(c))) })
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
