/**
 * Запасной режим хранения в IndexedDB для браузеров без File System Access
 * API, прежде всего Firefox (FR-23). Повторяет устройство папки: data.json,
 * резервные копии и иконки — отдельными записями.
 */

import { del, get, keys, set, setMany, type UseStore } from 'idb-keyval'
import { backupFileName, damagedFileName, isBackupName, sortBackups } from './backup-names'
import { appStore } from './kv'
import {
  StorageError,
  toStorageError,
  type BackupInfo,
  type StorageAdapter,
} from './storage-adapter'

const DATA_KEY = 'data'
const BACKUP_PREFIX = 'backup:'
const DAMAGED_PREFIX = 'damaged:'
const ICON_PREFIX = 'icon:'
/** Когда данные впервые легли в браузер: отсчёт для напоминания об экспорте */
const CREATED_AT_KEY = 'meta:created-at'

/** Картинка хранится байтами: Blob в IndexedDB клонируется не везде одинаково */
interface StoredIcon {
  type: string
  bytes: ArrayBuffer
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    throw toStorageError(e)
  }
}

export class IndexedDbStorage implements StorageAdapter {
  readonly kind = 'browser'
  readonly #store: UseStore

  constructor(store: UseStore = appStore()) {
    this.#store = store
  }

  async #names(prefix: string): Promise<string[]> {
    const all = await keys(this.#store)
    return all
      .filter((k): k is string => typeof k === 'string' && k.startsWith(prefix))
      .map((k) => k.slice(prefix.length))
  }

  readData(): Promise<string | null> {
    return guard(async () => (await get<string>(DATA_KEY, this.#store)) ?? null)
  }

  writeData(text: string): Promise<void> {
    return guard(async () => {
      const entries: [string, string][] = [[DATA_KEY, text]]
      if ((await get(CREATED_AT_KEY, this.#store)) === undefined) {
        entries.push([CREATED_AT_KEY, new Date().toISOString()])
      }
      // Одна транзакция: данные и отметка пишутся вместе или не пишутся вовсе
      await setMany(entries, this.#store)
    })
  }

  /** Дата первой записи данных в браузер или null, если данных ещё нет */
  createdAt(): Promise<Date | null> {
    return guard(async () => {
      const iso = await get<string>(CREATED_AT_KEY, this.#store)
      return iso === undefined ? null : new Date(iso)
    })
  }

  listBackups(): Promise<BackupInfo[]> {
    return guard(async () => sortBackups(await this.#names(BACKUP_PREFIX)))
  }

  async readBackup(name: string): Promise<string> {
    if (!isBackupName(name)) throw new StorageError('not-found', name)
    const text = await guard(() => get<string>(BACKUP_PREFIX + name, this.#store))
    if (text === undefined) throw new StorageError('not-found', name)
    return text
  }

  createBackup(text: string, at: Date): Promise<BackupInfo> {
    return guard(async () => {
      const name = backupFileName(at, await this.#names(BACKUP_PREFIX))
      await set(BACKUP_PREFIX + name, text, this.#store)
      return { name, createdAt: at }
    })
  }

  pruneBackups(keep: number): Promise<void> {
    return guard(async () => {
      const old = sortBackups(await this.#names(BACKUP_PREFIX)).slice(keep)
      for (const b of old) await del(BACKUP_PREFIX + b.name, this.#store)
    })
  }

  saveDamaged(text: string, at: Date): Promise<string> {
    return guard(async () => {
      const name = damagedFileName(at, await this.#names(DAMAGED_PREFIX))
      await set(DAMAGED_PREFIX + name, text, this.#store)
      return name
    })
  }

  readIcon(name: string): Promise<Blob | null> {
    return guard(async () => {
      const icon = await get<StoredIcon>(ICON_PREFIX + name, this.#store)
      return icon ? new Blob([icon.bytes], { type: icon.type }) : null
    })
  }

  writeIcon(name: string, data: Blob): Promise<void> {
    return guard(async () => {
      const icon: StoredIcon = { type: data.type, bytes: await data.arrayBuffer() }
      await set(ICON_PREFIX + name, icon, this.#store)
    })
  }

  deleteIcon(name: string): Promise<void> {
    return guard(() => del(ICON_PREFIX + name, this.#store))
  }
}
