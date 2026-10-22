/**
 * Хранение в папке на диске через File System Access API (FR-19):
 * data.json, icons/ и backups/.
 *
 * Запись идёт через createWritable: браузер пишет во временный файл и
 * подменяет им настоящий только при close(). Если вкладку закрыть во время
 * записи, data.json остаётся прежним (NFR-04).
 */

import { backupFileName, damagedFileName, isBackupName, sortBackups } from './backup-names'
import {
  StorageError,
  toStorageError,
  type BackupInfo,
  type StorageAdapter,
} from './storage-adapter'

export const DATA_FILE = 'data.json'
export const BACKUPS_DIR = 'backups'
export const ICONS_DIR = 'icons'

async function readText(dir: FileSystemDirectoryHandle, name: string): Promise<string | null> {
  try {
    const handle = await dir.getFileHandle(name)
    const file = await handle.getFile()
    return await file.text()
  } catch (e) {
    const err = toStorageError(e)
    if (err.kind === 'not-found') return null
    throw err
  }
}

async function writeFile(
  dir: FileSystemDirectoryHandle,
  name: string,
  data: string | Blob,
): Promise<void> {
  const handle = await dir.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  try {
    await writable.write(data)
    await writable.close()
  } catch (e) {
    // Без close() браузер выбрасывает временный файл, оригинал не меняется
    await writable.abort().catch(() => undefined)
    throw e
  }
}

async function listNames(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = []
  for await (const name of dir.keys()) names.push(name)
  return names
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    throw toStorageError(e)
  }
}

export class FileSystemStorage implements StorageAdapter {
  readonly kind = 'folder'
  readonly #root: FileSystemDirectoryHandle
  readonly #backups: FileSystemDirectoryHandle
  readonly #icons: FileSystemDirectoryHandle

  private constructor(
    root: FileSystemDirectoryHandle,
    backups: FileSystemDirectoryHandle,
    icons: FileSystemDirectoryHandle,
  ) {
    this.#root = root
    this.#backups = backups
    this.#icons = icons
  }

  /**
   * Открывает папку и создаёт в ней icons/ и backups/. Если папку удалили
   * или переместили, бросает StorageError с kind = 'not-found'.
   */
  static async open(root: FileSystemDirectoryHandle): Promise<FileSystemStorage> {
    return guard(async () => {
      const backups = await root.getDirectoryHandle(BACKUPS_DIR, { create: true })
      const icons = await root.getDirectoryHandle(ICONS_DIR, { create: true })
      return new FileSystemStorage(root, backups, icons)
    })
  }

  get folderName(): string {
    return this.#root.name
  }

  readData(): Promise<string | null> {
    return readText(this.#root, DATA_FILE)
  }

  writeData(text: string): Promise<void> {
    return guard(() => writeFile(this.#root, DATA_FILE, text))
  }

  listBackups(): Promise<BackupInfo[]> {
    return guard(async () => sortBackups(await listNames(this.#backups)))
  }

  async readBackup(name: string): Promise<string> {
    if (!isBackupName(name)) throw new StorageError('not-found', name)
    const text = await readText(this.#backups, name)
    if (text === null) throw new StorageError('not-found', name)
    return text
  }

  createBackup(text: string, at: Date): Promise<BackupInfo> {
    return guard(async () => {
      const name = backupFileName(at, await listNames(this.#backups))
      await writeFile(this.#backups, name, text)
      return { name, createdAt: at }
    })
  }

  pruneBackups(keep: number): Promise<void> {
    return guard(async () => {
      const old = sortBackups(await listNames(this.#backups)).slice(keep)
      for (const b of old) await this.#backups.removeEntry(b.name)
    })
  }

  saveDamaged(text: string, at: Date): Promise<string> {
    return guard(async () => {
      const name = damagedFileName(at, await listNames(this.#backups))
      await writeFile(this.#backups, name, text)
      return name
    })
  }

  async readIcon(name: string): Promise<Blob | null> {
    try {
      const handle = await this.#icons.getFileHandle(name)
      return await handle.getFile()
    } catch (e) {
      const err = toStorageError(e)
      if (err.kind === 'not-found') return null
      throw err
    }
  }

  writeIcon(name: string, data: Blob): Promise<void> {
    return guard(() => writeFile(this.#icons, name, data))
  }

  async deleteIcon(name: string): Promise<void> {
    try {
      await this.#icons.removeEntry(name)
    } catch (e) {
      const err = toStorageError(e)
      if (err.kind !== 'not-found') throw err
    }
  }
}
