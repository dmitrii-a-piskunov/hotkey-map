/**
 * Отмена и повтор (FR-24): команды, состояние кнопок и всплывающее
 * сообщение после удаления. История — zundo в store данных.
 */

import { useStore } from 'zustand'
import { create } from 'zustand'
import { focusAfterHistory } from '@/domain/history'
import { useDataStore } from '@/features/data/store'

function step(move: 'undo' | 'redo'): void {
  const before = useDataStore.getState().data
  useDataStore.temporal.getState()[move]()
  const after = useDataStore.getState().data
  if (after === before) return
  useDataStore.getState().updateSettings(focusAfterHistory(before, after.games))
}

export function undoCmd(): void {
  hideUndoToast()
  step('undo')
}

export function redoCmd(): void {
  hideUndoToast()
  step('redo')
}

export function useCanUndo(): boolean {
  return useStore(useDataStore.temporal, (s) => s.pastStates.length > 0)
}

export function useCanRedo(): boolean {
  return useStore(useDataStore.temporal, (s) => s.futureStates.length > 0)
}

/** Сколько видно сообщение после удаления */
export const UNDO_TOAST_MS = 8000

interface UndoToast {
  /** Текст «Удалено: …»; null — сообщения нет */
  message: string | null
  /** Номер сообщения: новое удаление перезапускает таймер */
  key: number
}

export const useUndoToast = create<UndoToast>()(() => ({ message: null, key: 0 }))

/** После удаления: сообщение с кнопкой «Отменить» */
export function notifyDeleted(message: string): void {
  // FR-27: во вкладке для просмотра удаление не применяется
  if (useDataStore.getState().readOnly) return
  useUndoToast.setState((s) => ({ message, key: s.key + 1 }))
}

export function hideUndoToast(): void {
  useUndoToast.setState({ message: null })
}
