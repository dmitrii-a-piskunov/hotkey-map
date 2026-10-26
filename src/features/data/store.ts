/**
 * Данные приложения — содержимое data.json (ТЗ, раздел 9.1). Каждое
 * изменение заменяет объект data целиком: сессия хранения сравнивает ссылки
 * и запускает автосохранение (FR-19).
 *
 * Изменения игр и профилей идут только через apply. Сами изменения — чистые
 * функции из src/domain, команды интерфейса — в src/features/.../commands.
 *
 * Отмена и повтор (FR-24) — zundo. В историю попадают только игры:
 * настройки приложения (тема, вид, режимы, последняя игра) в ней не
 * участвуют и при отмене не откатываются.
 */

import { temporal } from 'zundo'
import { create, type StateCreator, type StoreMutatorIdentifier } from 'zustand'
import { createAppData } from '@/domain/app-data'
import type { AppData, AppSettings, Game } from '@/domain/types'

/** FR-24: история в пределах сессии */
export const HISTORY_LIMIT = 50

interface DataState {
  data: AppData
  /** FR-27: приложение открыто в другой вкладке — правки здесь не применяются */
  readOnly: boolean
  setReadOnly: (readOnly: boolean) => void
  /** Данные, загруженные из хранилища или восстановленные из копии; история очищается */
  replaceData: (data: AppData) => void
  /** Изменение данных чистой функцией; тот же объект в ответ — изменений нет */
  apply: (change: (data: AppData) => AppData) => void
  updateSettings: (patch: Partial<AppSettings>) => void
}

/** Снимок истории: только игры */
interface HistoryState {
  games: Game[]
}

/**
 * zundo при отмене передаёт в set снимок истории — { games }. Прослойка
 * кладёт игры в data.games и оставляет настройки приложения текущими.
 */
const gamesIntoData =
  <Mos extends [StoreMutatorIdentifier, unknown][]>(
    config: StateCreator<DataState, [], Mos>,
  ): StateCreator<DataState, [], Mos> =>
  (set, get, store) => {
    const bridged: typeof set = (partial, replace) => {
      if (typeof partial === 'object' && 'games' in partial && !('data' in partial)) {
        const { games } = partial as HistoryState
        set({ data: { ...get().data, games } })
        return
      }
      if (replace === true) set(partial as DataState, true)
      else set(partial)
    }
    return config(bridged, get, store)
  }

export const useDataStore = create<DataState>()(
  gamesIntoData(
    temporal<DataState, [], [], HistoryState>(
      (set, get) => ({
        data: createAppData(),
        readOnly: false,

        setReadOnly: (readOnly) => {
          set({ readOnly })
        },

        replaceData: (data) => {
          set({ data })
          useDataStore.temporal.getState().clear()
        },
        apply: (change) => {
          if (get().readOnly) return
          set((s) => {
            const data = change(s.data)
            return data === s.data ? s : { data }
          })
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
      }),
      {
        limit: HISTORY_LIMIT,
        partialize: (s) => ({ games: s.data.games }),
        // Шаг истории — только когда изменились игры
        equality: (past, current) => past.games === current.games,
      },
    ),
  ),
)

/** Настройки приложения из data.json (тема, подписи, вид, режимы) */
export function useSettings<T>(selector: (settings: AppSettings) => T): T {
  return useDataStore((s) => selector(s.data.appSettings))
}
