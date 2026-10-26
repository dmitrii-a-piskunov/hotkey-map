/**
 * Импорт (FR-21): файл → проверка → предпросмотр со стратегиями → запись
 * иконок → изменение данных одним шагом. Пока пользователь не нажал
 * «Импортировать», данные не меняются (TC-10).
 */

import { create } from 'zustand'
import { systemClock, type Clock } from '@/domain/clock'
import { dataUrlBytes, EXPORT_EXTENSION } from '@/domain/export'
import { iconFileName } from '@/domain/icons'
import { IMPORT_MAX_BYTES, parseImportFile, type ImportIssue } from '@/domain/import-file'
import {
  applyImport,
  previewImport,
  type ImportChoice,
  type ImportPreview,
  type ImportReport,
  type ImportStrategy,
} from '@/domain/merge'
import type { ExportFile } from '@/domain/types'
import { useDataStore } from '@/features/data/store'
import type { PersistenceSession } from '@/features/persistence/session'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'

const t = ru.import

export type ImportState =
  | { phase: 'idle' }
  | { phase: 'reading'; fileName: string }
  | { phase: 'errors'; fileName: string; issues: ImportIssue[] }
  | {
      phase: 'preview'
      fileName: string
      file: ExportFile
      preview: ImportPreview
      choices: Record<string, ImportChoice>
      busy: boolean
    }
  | { phase: 'done'; fileName: string; report: ImportReport }

export const useImport = create<ImportState>()(() => ({ phase: 'idle' }))

const fail = (fileName: string, message: string): ImportState => ({
  phase: 'errors',
  fileName,
  issues: [{ place: '', message }],
})

/** Файл импорта: проверка без изменения данных, затем предпросмотр */
export async function openImportFile(file: File): Promise<void> {
  const fileName = file.name
  if (file.size > IMPORT_MAX_BYTES) {
    useImport.setState(fail(fileName, t.tooLarge), true)
    return
  }
  useImport.setState({ phase: 'reading', fileName }, true)

  let text: string
  try {
    text = await file.text()
  } catch (e) {
    console.error('Reading import file failed', e)
    useImport.setState(fail(fileName, t.readFailed), true)
    return
  }

  const parsed = parseImportFile(text)
  if (parsed.kind === 'newer') {
    useImport.setState(fail(fileName, fill(t.newer, { version: parsed.version })), true)
    return
  }
  if (parsed.kind === 'invalid') {
    useImport.setState({ phase: 'errors', fileName, issues: parsed.issues }, true)
    return
  }
  showPreview(fileName, parsed.file)
}

/** Предпросмотр готового файла: импорт или заготовка (FR-22) */
export function showPreview(fileName: string, file: ExportFile): void {
  const preview = previewImport(useDataStore.getState().data, file)
  const choices: Record<string, ImportChoice> = {}
  for (const g of preview.games) choices[g.id] = { strategy: 'merge', profiles: {} }
  useImport.setState({ phase: 'preview', fileName, file, preview, choices, busy: false }, true)
}

export function setGameStrategy(gameId: string, strategy: ImportStrategy): void {
  useImport.setState((s) => {
    if (s.phase !== 'preview') return s
    const current = s.choices[gameId] ?? { strategy: 'merge', profiles: {} }
    return { ...s, choices: { ...s.choices, [gameId]: { ...current, strategy } } }
  })
}

export function setProfileStrategy(
  gameId: string,
  profileId: string,
  strategy: ImportStrategy,
): void {
  useImport.setState((s) => {
    if (s.phase !== 'preview') return s
    const current = s.choices[gameId] ?? { strategy: 'merge', profiles: {} }
    const profiles = { ...current.profiles, [profileId]: strategy }
    return { ...s, choices: { ...s.choices, [gameId]: { ...current, profiles } } }
  })
}

export function closeImport(): void {
  useImport.setState({ phase: 'idle' }, true)
}

/** Иконки из файла → файлы в icons/ под новыми именами; что не записалось, не переносится */
async function writeIcons(
  session: Pick<PersistenceSession, 'writeIcon'>,
  file: ExportFile,
  clock: Clock,
): Promise<Record<string, string>> {
  const written: Record<string, string> = {}
  for (const game of file.games) {
    const name = game.icon
    if (name === undefined || name in written) continue
    const data = file.icons?.[name]
    const bytes = data === undefined ? null : dataUrlBytes(data)
    if (!bytes) continue
    const next = iconFileName(game.id, clock.id())
    try {
      await session.writeIcon(next, new Blob([bytes], { type: 'image/png' }))
      written[name] = next
    } catch (e) {
      console.error('Writing imported icon failed', name, e)
    }
  }
  return written
}

/** «Импортировать»: одно изменение данных, затем итог */
export async function confirmImport(
  session: Pick<PersistenceSession, 'writeIcon'>,
  clock: Clock = systemClock,
): Promise<void> {
  const state = useImport.getState()
  if (state.phase !== 'preview' || state.busy) return
  useImport.setState({ ...state, busy: true }, true)

  const icons = await writeIcons(session, state.file, clock)
  const result = applyImport(useDataStore.getState().data, state.file, state.choices, clock, icons)
  if (result.kind === 'error') {
    console.error('Import result failed the schema', result.messages)
    useImport.setState(fail(state.fileName, t.failed), true)
    return
  }
  useDataStore.getState().apply(() => result.data)
  useImport.setState({ phase: 'done', fileName: state.fileName, report: result.report }, true)
}

/** Похоже на файл импорта: по имени, а если имени нет — любой JSON */
export function isImportFileName(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith(EXPORT_EXTENSION) || lower.endsWith('.json')
}
