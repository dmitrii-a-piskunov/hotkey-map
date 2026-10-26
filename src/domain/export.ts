/**
 * Экспорт в файл *.hotkeymap.json (FR-21, раздел 9.4): сборка файла, имя
 * файла, иконки в Base64. Чистые функции; чтение иконок и скачивание — в
 * src/features/transfer.
 */

import { CURRENT_SCHEMA_VERSION } from './schema'
import type { AppData, ExportFile } from './types'

export type ExportTarget =
  | { scope: 'all' }
  | { scope: 'game'; gameId: string }
  | { scope: 'profile'; gameId: string; profileId: string }

/**
 * Файл экспорта без иконок. Профиль выгружается вместе с игрой и её
 * справочниками, но без других профилей. null — игры или профиля нет.
 */
export function buildExport(data: AppData, target: ExportTarget, now: Date): ExportFile | null {
  const exportedAt = now.toISOString()
  const base: Pick<ExportFile, 'schemaVersion' | 'scope' | 'exportedAt'> = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    scope: target.scope,
    exportedAt,
  }
  if (target.scope === 'all') {
    return {
      ...base,
      games: data.games,
      appSettings: { ...data.appSettings, lastExportAt: exportedAt },
    }
  }
  const game = data.games.find((g) => g.id === target.gameId)
  if (!game) return null
  if (target.scope === 'game') return { ...base, games: [game] }
  const profile = game.profiles.find((p) => p.id === target.profileId)
  if (!profile) return null
  return { ...base, games: [{ ...game, profiles: [profile] }] }
}

/** Имена иконок, которые нужно встроить в файл */
export function exportIconNames(file: ExportFile): string[] {
  const names = new Set<string>()
  for (const game of file.games) if (game.icon !== undefined) names.add(game.icon)
  return [...names].sort()
}

const SLUG_MAX = 40

/** Часть имени файла из названия: «Dota 2» → «dota-2»; запрещённые в Windows знаки уходят */
export function fileSlug(name: string): string {
  return name
    .toLocaleLowerCase('ru')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .slice(0, SLUG_MAX)
    .replace(/^-+|-+$/g, '')
}

function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const EXPORT_EXTENSION = '.hotkeymap.json'

/** dota-2-2026-10-26.hotkeymap.json, dota-2-основной-…, hotkeymap-… для всего */
export function exportFileName(file: ExportFile, now: Date): string {
  const game = file.scope === 'all' ? undefined : file.games[0]
  const parts = [game ? fileSlug(game.name) : '']
  if (file.scope === 'profile' && game?.profiles[0]) parts.push(fileSlug(game.profiles[0].name))
  const slug = parts.filter((p) => p !== '').join('-') || 'hotkeymap'
  return `${slug}-${localDate(now)}${EXPORT_EXTENSION}`
}

export function serializeExport(file: ExportFile): string {
  return `${JSON.stringify(file, null, 2)}\n`
}

const PNG_PREFIX = 'data:image/png;base64,'
const CHUNK = 0x8000

/** Иконка в файле экспорта: data URL PNG */
export function pngDataUrl(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return PNG_PREFIX + btoa(binary)
}

/** Байты иконки из data URL; null — не PNG в Base64 */
export function dataUrlBytes(url: string): Uint8Array<ArrayBuffer> | null {
  if (!url.startsWith(PNG_PREFIX)) return null
  try {
    const binary = atob(url.slice(PNG_PREFIX.length))
    return Uint8Array.from(binary, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}
