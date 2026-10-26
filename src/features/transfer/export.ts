/**
 * Экспорт (FR-21): файл собирается чистой функцией, иконки читаются через
 * сессию хранения и встраиваются в Base64, файл скачивается.
 */

import {
  buildExport,
  exportFileName,
  exportIconNames,
  pngDataUrl,
  serializeExport,
  type ExportTarget,
} from '@/domain/export'
import { useDataStore } from '@/features/data/store'
import type { PersistenceSession } from '@/features/persistence/session'
import { downloadFile } from '@/lib/download'

type IconReader = Pick<PersistenceSession, 'readIcon'>

async function readIcons(session: IconReader, names: string[]): Promise<Record<string, string>> {
  const icons: Record<string, string> = {}
  for (const name of names) {
    const blob = await session.readIcon(name)
    // Иконки нет в папке — игра выгружается без неё, как и показывается
    if (blob) icons[name] = pngDataUrl(new Uint8Array(await blob.arrayBuffer()))
  }
  return icons
}

/** Собрать и скачать файл; false — игры или профиля уже нет */
export async function exportToFile(
  session: IconReader & Pick<PersistenceSession, 'dismissExportReminder'>,
  target: ExportTarget,
  now = new Date(),
): Promise<boolean> {
  const store = useDataStore.getState()
  const file = buildExport(store.data, target, now)
  if (!file) return false

  const icons = await readIcons(session, exportIconNames(file))
  const withIcons = Object.keys(icons).length > 0 ? { ...file, icons } : file
  downloadFile(exportFileName(file, now), serializeExport(withIcons))

  // FR-23: напоминание считает от экспорта всего
  if (target.scope === 'all') {
    store.updateSettings({ lastExportAt: file.exportedAt })
    session.dismissExportReminder()
  }
  return true
}
