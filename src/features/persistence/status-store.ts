/**
 * Состояние хранения для интерфейса: какой экран показать при запуске,
 * статус сохранения в шапке и плашки (FR-19, FR-20, FR-23, раздел 13.1).
 */

import { create } from 'zustand'
import type { BackupInfo } from '@/storage/storage-adapter'

export type Phase =
  | { name: 'loading' }
  /** Сценарий 1: папка ещё не выбрана */
  | { name: 'first-run' }
  /** Браузер снова спрашивает разрешение на папку */
  | { name: 'need-permission' }
  | { name: 'folder-missing' }
  /** data.json повреждён; restoreFailed — копия, которую не удалось прочитать */
  | { name: 'corrupted'; backups: BackupInfo[]; restoreFailed: string | null }
  | { name: 'newer'; version: number }
  /** Неожиданная ошибка при запуске */
  | { name: 'failed' }
  | { name: 'ready' }

export type SaveStatus = 'saved' | 'saving' | 'error'

export interface PersistenceStatus {
  phase: Phase
  mode: 'folder' | 'browser' | null
  folderName: string | null
  saveStatus: SaveStatus
  /** Причина ошибки записи: без разрешения повторять бесполезно */
  saveError: 'io' | 'permission' | null
  /** Есть изменения, которые ещё не легли в хранилище */
  dirty: boolean
  /** FR-23: давно не было экспорта */
  exportReminder: boolean
}

export const initialPersistenceStatus: PersistenceStatus = {
  phase: { name: 'loading' },
  mode: null,
  folderName: null,
  saveStatus: 'saved',
  saveError: null,
  dirty: false,
  exportReminder: false,
}

export const usePersistenceStatus = create<PersistenceStatus>()(() => initialPersistenceStatus)
