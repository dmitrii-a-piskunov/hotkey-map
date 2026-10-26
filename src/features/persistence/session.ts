/**
 * Сессия хранения: связывает store данных с хранилищем (ТЗ, FR-19, FR-20,
 * FR-23, разделы 9.3 и 13.1). Компоненты не трогают хранилище сами: они
 * меняют store, а сессия сохраняет изменения и сообщает статус.
 *
 * Запуск: проверка браузера → ссылка на папку → разрешение → data.json →
 * миграции → проверка схемой. Итог каждого шага — экран в status-store.
 */

import { createAppData, parseAppData, serializeAppData } from '@/domain/app-data'
import { needsExportReminder } from '@/domain/export-reminder'
import { unusedIcons } from '@/domain/icons'
import type { AppData } from '@/domain/types'
import { useDataStore } from '@/features/data/store'
import type { FolderAccess } from '@/storage/folder-access'
import {
  BACKUPS_TO_KEEP,
  toStorageError,
  type StorageAdapter,
  type StorageError,
} from '@/storage/storage-adapter'
import { usePersistenceStatus, type PersistenceStatus } from './status-store'

/** FR-19: запись через 1 с после последнего изменения */
export const SAVE_DELAY_MS = 1000
/** Раздел 13.1: при ошибке записи повтор через 5 с, до 3 раз */
export const RETRY_DELAY_MS = 5000
export const MAX_RETRIES = 3

export interface FolderStorage extends StorageAdapter {
  readonly folderName: string
}

export interface BrowserStorage extends StorageAdapter {
  /** Когда данные впервые легли в браузер, для напоминания об экспорте */
  createdAt(): Promise<Date | null>
}

export interface PersistenceEnv {
  folders: FolderAccess
  /** IndexedDB даже там, где есть выбор папки: ?storage=browser в dev-сборке для e2e */
  forceBrowser: boolean
  openFolder(handle: FileSystemDirectoryHandle): Promise<FolderStorage>
  browserStorage(): BrowserStorage
  now(): Date
}

type Timer = ReturnType<typeof setTimeout>

export class PersistenceSession {
  readonly #env: PersistenceEnv
  #storage: StorageAdapter | null = null
  #browser: BrowserStorage | null = null
  #handle: FileSystemDirectoryHandle | null = null
  /** data.json в момент запуска: из него делается копия перед первой записью */
  #launchText: string | null = null
  #backupDone = false
  /** Папку только что выбрали в окне выбора: пустой папке предлагаются заготовки */
  #folderChosen = false
  /** Текст повреждённого data.json, пока пользователь выбирает, что делать */
  #damagedText: string | null = null
  #saveTimer: Timer | null = null
  #retryTimer: Timer | null = null
  #retries = 0
  #saving: Promise<void> | null = null
  #saveAgain = false
  #unsubscribe: (() => void) | null = null
  /** Уборка иконок после запуска; промис — для тестов */
  sweeping: Promise<void> = Promise.resolve()

  constructor(env: PersistenceEnv) {
    this.#env = env
  }

  #set(patch: Partial<PersistenceStatus>): void {
    usePersistenceStatus.setState(patch)
  }

  async start(): Promise<void> {
    this.#set({ phase: { name: 'loading' } })
    try {
      const { folders, forceBrowser } = this.#env
      if (!folders.supported || forceBrowser) {
        // FR-23: папки нет, данные живут в IndexedDB
        this.#browser = this.#env.browserStorage()
        this.#storage = this.#browser
        this.#set({ mode: 'browser' })
        await this.#load()
        return
      }
      this.#set({ mode: 'folder' })
      const handle = await folders.loadSaved()
      if (!handle) {
        this.#set({ phase: { name: 'first-run' } })
        return
      }
      this.#handle = handle
      if (!(await folders.hasPermission(handle))) {
        this.#set({ phase: { name: 'need-permission' } })
        return
      }
      await this.#openFolder()
    } catch (e) {
      this.#fail(e)
    }
  }

  /** Первый запуск и «Папка данных не найдена»: окно выбора папки */
  async chooseFolder(): Promise<void> {
    try {
      const handle = await this.#env.folders.pick()
      if (!handle) return
      await this.#env.folders.save(handle)
      this.#handle = handle
      this.#folderChosen = true
      this.#set({ phase: { name: 'loading' } })
      await this.#openFolder()
    } catch (e) {
      this.#fail(e)
    }
  }

  /** «Разрешить доступ»: при запуске или когда запись упала без разрешения */
  async grantPermission(): Promise<void> {
    const handle = this.#handle
    if (!handle) return
    try {
      if (!(await this.#env.folders.requestPermission(handle))) return
      if (usePersistenceStatus.getState().phase.name === 'ready') {
        await this.retrySave()
      } else {
        await this.#openFolder()
      }
    } catch (e) {
      this.#fail(e)
    }
  }

  /** «Файл данных повреждён» → «Восстановить» (FR-20, TC-12) */
  async restoreBackup(name: string): Promise<void> {
    const storage = this.#storage
    if (!storage) return
    try {
      const result = parseAppData(await storage.readBackup(name))
      if (result.kind !== 'ok') {
        const backups = await storage.listBackups()
        this.#set({ phase: { name: 'corrupted', backups, restoreFailed: name } })
        return
      }
      await this.#replaceDamaged(storage, result.data)
    } catch (e) {
      this.#fail(e)
    }
  }

  /** «Файл данных повреждён» → «Начать с пустыми данными» */
  async startEmpty(): Promise<void> {
    const storage = this.#storage
    if (!storage) return
    try {
      await this.#replaceDamaged(storage, createAppData())
    } catch (e) {
      this.#fail(e)
    }
  }

  /** «Повторить» на плашке ошибки записи */
  async retrySave(): Promise<void> {
    this.#retries = 0
    this.#clearRetry()
    await this.#save()
  }

  /** Записать несохранённое сейчас, без ожидания (закрытие вкладки) */
  async flush(): Promise<void> {
    if (usePersistenceStatus.getState().dirty) await this.#save()
  }

  /** Иконка игры из icons/ (FR-05); null — файла нет или хранилище не открыто */
  async readIcon(name: string): Promise<Blob | null> {
    const storage = this.#storage
    if (!storage) return null
    try {
      return await storage.readIcon(name)
    } catch (e) {
      console.error('Reading icon failed', name, e)
      return null
    }
  }

  async writeIcon(name: string, data: Blob): Promise<void> {
    const storage = this.#storage
    if (!storage) throw new Error('Storage is not open')
    await storage.writeIcon(name, data)
  }

  dismissExportReminder(): void {
    this.#set({ exportReminder: false })
  }

  dispose(): void {
    this.#unsubscribe?.()
    this.#unsubscribe = null
    if (this.#saveTimer) clearTimeout(this.#saveTimer)
    this.#clearRetry()
  }

  async #openFolder(): Promise<void> {
    const handle = this.#handle
    if (!handle) return
    let storage: FolderStorage
    try {
      storage = await this.#env.openFolder(handle)
    } catch (e) {
      const err = toStorageError(e)
      if (err.kind === 'not-found') {
        this.#set({ phase: { name: 'folder-missing' } })
        return
      }
      throw err
    }
    this.#storage = storage
    this.#set({ folderName: storage.folderName })
    await this.#load()
  }

  async #load(): Promise<void> {
    const storage = this.#storage
    if (!storage) return
    const text = await storage.readData()
    if (text === null) {
      // Сценарий 1: в новой папке сразу появляется data.json
      const data = createAppData()
      await storage.writeData(serializeAppData(data))
      this.#launchText = null
      this.#backupDone = true
      await this.#ready(data, false)
      // Шаг 4 — заготовки. В режиме Firefox папку не выбирают: там пустой экран с «Из заготовок»
      if (this.#folderChosen) this.#set({ offerPresets: true })
      return
    }

    const result = parseAppData(text)
    if (result.kind === 'newer') {
      // Раздел 9.3: данные новее приложения не открываются на запись
      this.#set({ phase: { name: 'newer', version: result.version } })
      return
    }
    if (result.kind === 'corrupted') {
      console.error('data.json is corrupted', result.issues)
      this.#damagedText = text
      const backups = await storage.listBackups()
      this.#set({ phase: { name: 'corrupted', backups, restoreFailed: null } })
      return
    }

    this.#launchText = text
    this.#backupDone = false
    if (result.migratedFrom !== null) {
      // Раздел 9.3: перед миграцией — резервная копия
      await this.#backup(storage)
    }
    await this.#ready(result.data, result.migratedFrom !== null)
  }

  async #replaceDamaged(storage: StorageAdapter, data: AppData): Promise<void> {
    if (this.#damagedText !== null) {
      await storage.saveDamaged(this.#damagedText, this.#env.now())
      this.#damagedText = null
    }
    await storage.writeData(serializeAppData(data))
    // Восстановленные данные уже лежат в копии, повторять её незачем
    this.#launchText = null
    this.#backupDone = true
    await this.#ready(data, false)
  }

  async #ready(data: AppData, needsSave: boolean): Promise<void> {
    this.#unsubscribe?.()
    useDataStore.getState().replaceData(data)
    this.#unsubscribe = useDataStore.subscribe((s, prev) => {
      if (s.data !== prev.data) this.#changed()
    })

    let exportReminder = false
    if (this.#browser) {
      const since = await this.#browser.createdAt()
      exportReminder = needsExportReminder(this.#env.now(), data.appSettings.lastExportAt, since)
    }
    this.#set({
      phase: { name: 'ready' },
      saveStatus: 'saved',
      saveError: null,
      dirty: false,
      exportReminder,
    })
    if (needsSave) this.#changed()
    this.sweeping = this.#sweepIcons().catch((e: unknown) => {
      console.error('Icon cleanup failed', e)
    })
  }

  /**
   * Иконки, на которые не ссылаются ни data.json, ни резервные копии,
   * удаляются при запуске. Сразу при замене иконки файл не удаляется:
   * отмена изменения (FR-24) вернёт ссылку на него.
   */
  async #sweepIcons(): Promise<void> {
    const storage = this.#storage
    if (!storage) return
    const files = await storage.listIcons()
    if (files.length === 0) return
    const texts: string[] = []
    for (const backup of await storage.listBackups()) {
      texts.push(await storage.readBackup(backup.name))
    }
    // Текущие данные — последними, чтобы учесть иконку, добавленную только что
    texts.push(serializeAppData(useDataStore.getState().data))
    for (const name of unusedIcons(files, texts)) await storage.deleteIcon(name)
  }

  #changed(): void {
    this.#set({ dirty: true, saveStatus: 'saving' })
    if (this.#saveTimer) clearTimeout(this.#saveTimer)
    this.#saveTimer = setTimeout(() => {
      this.#saveTimer = null
      void this.#save()
    }, SAVE_DELAY_MS)
  }

  async #backup(storage: StorageAdapter): Promise<void> {
    if (this.#backupDone) return
    if (this.#launchText !== null) {
      await storage.createBackup(this.#launchText, this.#env.now())
      await storage.pruneBackups(BACKUPS_TO_KEEP)
    }
    this.#backupDone = true
  }

  #save(): Promise<void> {
    if (this.#saving) {
      // Запись уже идёт: после неё запишем ещё раз, с последними данными
      this.#saveAgain = true
      return this.#saving
    }
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer)
      this.#saveTimer = null
    }
    this.#saving = this.#write().finally(() => {
      this.#saving = null
      if (this.#saveAgain) {
        this.#saveAgain = false
        void this.#save()
      }
    })
    return this.#saving
  }

  async #write(): Promise<void> {
    const storage = this.#storage
    if (!storage) return
    const data = useDataStore.getState().data
    this.#set({ saveStatus: 'saving' })
    try {
      // FR-20: копия data.json перед первой записью в сессии
      await this.#backup(storage)
      await storage.writeData(serializeAppData(data))
      this.#retries = 0
      this.#clearRetry()
      const stillDirty = useDataStore.getState().data !== data
      this.#set({
        dirty: stillDirty,
        saveStatus: stillDirty ? 'saving' : 'saved',
        saveError: null,
      })
    } catch (e) {
      this.#writeFailed(toStorageError(e))
    }
  }

  #writeFailed(err: StorageError): void {
    console.error('Saving data failed', err)
    const permission = err.kind === 'permission'
    this.#set({ saveStatus: 'error', saveError: permission ? 'permission' : 'io' })
    // Без разрешения повтор не поможет: ждём кнопку «Разрешить доступ»
    if (permission || this.#retries >= MAX_RETRIES) return
    this.#retries++
    this.#clearRetry()
    this.#retryTimer = setTimeout(() => {
      this.#retryTimer = null
      void this.#save()
    }, RETRY_DELAY_MS)
  }

  #clearRetry(): void {
    if (this.#retryTimer) clearTimeout(this.#retryTimer)
    this.#retryTimer = null
  }

  #fail(e: unknown): void {
    const err = toStorageError(e)
    if (err.kind === 'permission' && this.#handle) {
      this.#set({ phase: { name: 'need-permission' } })
      return
    }
    console.error('Storage failed', e)
    this.#set({ phase: { name: 'failed' } })
  }
}
