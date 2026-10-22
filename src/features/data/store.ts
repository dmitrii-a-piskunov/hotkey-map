/**
 * Данные приложения — содержимое data.json (ТЗ, раздел 9.1). Каждое
 * изменение заменяет объект data целиком: сессия хранения сравнивает ссылки
 * и запускает автосохранение (FR-19). Отмена и повтор (zundo) — на этапе 5.
 */

import { create } from 'zustand'
import { createAppData } from '@/domain/app-data'
import type { AppData, AppSettings } from '@/domain/types'

interface DataState {
  data: AppData
  /** Данные, загруженные из хранилища или восстановленные из копии */
  replaceData: (data: AppData) => void
  updateSettings: (patch: Partial<AppSettings>) => void
}

export const useDataStore = create<DataState>()((set) => ({
  data: createAppData(),

  replaceData: (data) => {
    set({ data })
  },
  updateSettings: (patch) => {
    set((s) => {
      const current = s.data.appSettings
      const changed = (Object.keys(patch) as (keyof AppSettings)[]).some(
        (k) => patch[k] !== current[k],
      )
      return changed ? { data: { ...s.data, appSettings: { ...current, ...patch } } } : s
    })
  },
}))

/** Настройки приложения из data.json (тема, подписи, вид, режимы) */
export function useSettings<T>(selector: (settings: AppSettings) => T): T {
  return useDataStore((s) => selector(s.data.appSettings))
}
