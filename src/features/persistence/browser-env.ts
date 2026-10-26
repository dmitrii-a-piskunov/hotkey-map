/** Окружение сессии хранения в настоящем браузере */

import { FileSystemStorage } from '@/storage/file-system-storage'
import { browserFolderAccess } from '@/storage/folder-access'
import { IndexedDbStorage } from '@/storage/indexed-db-storage'
import type { PersistenceEnv } from './session'
import { broadcastTabGuard } from './tab-guard'

/**
 * ?storage=browser включает IndexedDB там, где есть выбор папки. Нужно для
 * e2e: Playwright не умеет работать с системным окном выбора папки. Только
 * в dev-сборке (e2e идут на dev-сервере): в продакшн-сборке условие
 * import.meta.env.DEV равно false, и параметр не действует.
 */
function forceBrowserStorage(): boolean {
  if (!import.meta.env.DEV) return false
  return new URLSearchParams(window.location.search).get('storage') === 'browser'
}

export function browserPersistenceEnv(): PersistenceEnv {
  return {
    folders: browserFolderAccess(),
    forceBrowser: forceBrowserStorage(),
    openFolder: (handle) => FileSystemStorage.open(handle),
    browserStorage: () => new IndexedDbStorage(),
    tabs: broadcastTabGuard(),
    now: () => new Date(),
  }
}
