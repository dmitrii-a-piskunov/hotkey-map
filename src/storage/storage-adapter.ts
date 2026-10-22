/**
 * Интерфейс хранилища (ТЗ, NFR-11): папка на диске или IndexedDB.
 * Хранилище работает с текстом data.json и не знает про схему данных —
 * разбор и миграции в src/domain/app-data.
 */

export interface BackupInfo {
  /** Имя файла копии, по нему копия читается */
  name: string
  createdAt: Date
}

/** Сколько резервных копий хранить (FR-20) */
export const BACKUPS_TO_KEEP = 5

export interface StorageAdapter {
  /** folder — папка на диске, browser — запасной режим в IndexedDB (FR-23) */
  readonly kind: 'folder' | 'browser'
  /** Текст data.json или null, если файла ещё нет */
  readData(): Promise<string | null>
  /** Записывает data.json целиком; файл подменяется только после полной записи */
  writeData(text: string): Promise<void>
  /** Резервные копии, новые первыми */
  listBackups(): Promise<BackupInfo[]>
  readBackup(name: string): Promise<string>
  createBackup(text: string, at: Date): Promise<BackupInfo>
  /** Удаляет копии сверх keep самых новых */
  pruneBackups(keep: number): Promise<void>
  /**
   * Откладывает повреждённый data.json рядом с копиями. Такие файлы не
   * считаются копиями: не вытесняют их и не попадают в список восстановления.
   */
  saveDamaged(text: string, at: Date): Promise<string>
  readIcon(name: string): Promise<Blob | null>
  writeIcon(name: string, data: Blob): Promise<void>
  deleteIcon(name: string): Promise<void>
}

/**
 * not-found — нет папки или файла, permission — нет разрешения на папку,
 * io — остальные ошибки чтения и записи.
 */
export type StorageErrorKind = 'not-found' | 'permission' | 'io'

export class StorageError extends Error {
  readonly kind: StorageErrorKind

  constructor(kind: StorageErrorKind, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'StorageError'
    this.kind = kind
  }
}

export function toStorageError(e: unknown): StorageError {
  if (e instanceof StorageError) return e
  const name = e instanceof DOMException || e instanceof Error ? e.name : ''
  const message = e instanceof Error ? e.message : String(e)
  if (name === 'NotFoundError') return new StorageError('not-found', message, { cause: e })
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new StorageError('permission', message, { cause: e })
  }
  return new StorageError('io', message, { cause: e })
}
