/**
 * Окружение сессии хранения для тестов: папка в памяти вместо диска,
 * отдельная база fake-indexeddb на каждый тест, управляемое окно выбора.
 */

import { createStore } from 'idb-keyval'
import { createAppData } from '@/domain/app-data'
import { useDataStore } from '@/features/data/store'
import type { PersistenceEnv } from '@/features/persistence/session'
import { initialPersistenceStatus, usePersistenceStatus } from '@/features/persistence/status-store'
import { FileSystemStorage } from '@/storage/file-system-storage'
import type { FolderAccess } from '@/storage/folder-access'
import { IndexedDbStorage } from '@/storage/indexed-db-storage'
import { asHandle, memoryFolder, type MemoryDirHandle } from './memory-fs'

let dbCounter = 0

export interface TestEnv {
  env: PersistenceEnv
  /** Папка, которую вернёт окно выбора */
  folder: MemoryDirHandle
  /** Ссылка на папку, сохранённая «в IndexedDB» */
  saved: FileSystemDirectoryHandle | null
  /** Пользователь закрыл окно выбора */
  pickCancelled: boolean
  /** FR-27: приложение уже открыто в другой вкладке */
  otherTab: boolean
}

export function makeTestEnv(
  options: { supported?: boolean; savedFolder?: boolean; otherTab?: boolean } = {},
): TestEnv {
  const folder = memoryFolder()
  const browserDb = createStore(`session-${++dbCounter}`, 'kv')
  const state: TestEnv = {
    env: undefined as unknown as PersistenceEnv,
    folder,
    saved: options.savedFolder ? asHandle(folder) : null,
    pickCancelled: false,
    otherTab: options.otherTab ?? false,
  }

  const folders: FolderAccess = {
    supported: options.supported ?? true,
    pick: () => Promise.resolve(state.pickCancelled ? null : asHandle(state.folder)),
    loadSaved: () => Promise.resolve(state.saved),
    save: (handle) => {
      state.saved = handle
      return Promise.resolve()
    },
    hasPermission: async (handle) => (await handle.queryPermission?.()) === 'granted',
    requestPermission: async (handle) => (await handle.requestPermission?.()) === 'granted',
  }

  state.env = {
    folders,
    forceBrowser: false,
    openFolder: (handle) => FileSystemStorage.open(handle),
    browserStorage: () => new IndexedDbStorage(browserDb),
    tabs: { otherTabOpen: () => Promise.resolve(state.otherTab) },
    now: () => new Date(),
  }
  return state
}

export function resetStores(): void {
  usePersistenceStatus.setState(initialPersistenceStatus)
  useDataStore.getState().setReadOnly(false)
  useDataStore.getState().replaceData(createAppData())
}

export const phase = () => usePersistenceStatus.getState().phase.name
export const status = () => usePersistenceStatus.getState()
export const settings = () => useDataStore.getState().data.appSettings
