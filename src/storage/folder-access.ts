/**
 * Выбор папки данных, ссылка на неё в IndexedDB и разрешения (FR-19).
 * Отделено от хранилища, чтобы сессию можно было проверить без браузера.
 */

import { get, set, type UseStore } from 'idb-keyval'
import { appStore } from './kv'

const HANDLE_KEY = 'meta:folder-handle'
const PERMISSION: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' }

export interface FolderAccess {
  /** Есть ли в браузере выбор папки (Chrome, Edge) */
  readonly supported: boolean
  /** Окно выбора папки; null, если пользователь его закрыл */
  pick(): Promise<FileSystemDirectoryHandle | null>
  loadSaved(): Promise<FileSystemDirectoryHandle | null>
  save(handle: FileSystemDirectoryHandle): Promise<void>
  hasPermission(handle: FileSystemDirectoryHandle): Promise<boolean>
  /** Нужен жест пользователя: вызывать из обработчика клика */
  requestPermission(handle: FileSystemDirectoryHandle): Promise<boolean>
}

export function browserFolderAccess(store: UseStore = appStore()): FolderAccess {
  return {
    supported: typeof window !== 'undefined' && 'showDirectoryPicker' in window,

    async pick() {
      if (!window.showDirectoryPicker) return null
      try {
        return await window.showDirectoryPicker({ id: 'hotkey-map-data', mode: 'readwrite' })
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return null
        throw e
      }
    },

    async loadSaved() {
      return (await get<FileSystemDirectoryHandle>(HANDLE_KEY, store)) ?? null
    },

    async save(handle) {
      await set(HANDLE_KEY, handle, store)
    },

    async hasPermission(handle) {
      if (!handle.queryPermission) return true
      return (await handle.queryPermission(PERMISSION)) === 'granted'
    },

    async requestPermission(handle) {
      if (!handle.requestPermission) return true
      return (await handle.requestPermission(PERMISSION)) === 'granted'
    },
  }
}
