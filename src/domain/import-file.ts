/**
 * Проверка файла импорта (FR-21, TC-10): разбор JSON, миграции по
 * schemaVersion, схема файла экспорта. Ошибки — списком с понятным местом:
 * «Игра «Dota 2» → действие 12 → contextId». Данные приложения здесь не
 * меняются.
 */

import { ru } from '@/i18n/ru'
import { migrate, MIGRATIONS, type Migrations } from './migrations'
import { exportFileSchema } from './schema'
import type { ExportFile } from './types'

/** Раздел 9.4: лимит файла импорта */
export const IMPORT_MAX_BYTES = 20 * 1024 * 1024

export interface ImportIssue {
  /** Где ошибка; пусто — файл целиком */
  place: string
  message: string
}

export type ImportParse =
  | { kind: 'ok'; file: ExportFile }
  | { kind: 'newer'; version: number }
  | { kind: 'invalid'; issues: ImportIssue[] }

const t = ru.import

const SEGMENTS: Readonly<Record<string, string>> = t.segments

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('ru') + text.slice(1)
}

/**
 * Место ошибки по пути Zod. Элементы списков называются по имени, если оно
 * есть в файле, иначе по номеру с единицы.
 */
export function issuePlace(path: readonly PropertyKey[], raw: unknown): string {
  const parts: string[] = []
  let node: unknown = raw
  for (let i = 0; i < path.length; i++) {
    const key = path[i]
    const next = path[i + 1]
    const label = typeof key === 'string' ? SEGMENTS[key] : undefined
    const child: unknown = isRecord(node) && typeof key === 'string' ? node[key] : undefined

    if (label !== undefined && typeof next === 'number' && Array.isArray(child)) {
      const item: unknown = child[next]
      const name = isRecord(item) && typeof item.name === 'string' ? item.name.trim() : ''
      parts.push(name !== '' ? `${label} «${name}»` : `${label} ${String(next + 1)}`)
      node = item
      i++
      continue
    }
    if (label !== undefined && key === 'icons' && typeof next === 'string') {
      parts.push(`${label} ${next}`)
      node = undefined
      i++
      continue
    }
    parts.push(String(key))
    node = Array.isArray(node) && typeof key === 'number' ? node[key] : child
  }
  return parts.length > 0 ? capitalize(parts.join(' → ')) : ''
}

export function parseImportFile(text: string, steps: Migrations = MIGRATIONS): ImportParse {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { kind: 'invalid', issues: [{ place: '', message: t.notJson }] }
  }

  const migrated = migrate(raw, steps)
  if (migrated.kind === 'newer') return migrated
  if (migrated.kind === 'invalid') {
    const message =
      migrated.reason === 'not-object'
        ? t.notObject
        : migrated.reason === 'no-version'
          ? t.noVersion
          : t.noStep
    return { kind: 'invalid', issues: [{ place: '', message }] }
  }

  const parsed = exportFileSchema.safeParse(migrated.data)
  if (!parsed.success) {
    return {
      kind: 'invalid',
      issues: parsed.error.issues.map((i) => ({
        place: issuePlace(i.path, migrated.data),
        message: i.message,
      })),
    }
  }
  return { kind: 'ok', file: parsed.data }
}
