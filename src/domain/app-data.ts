/**
 * Чтение и запись data.json: разбор текста, миграции, проверка схемой
 * (ТЗ, разделы 9.3 и 13.1). Чистые функции, без доступа к хранилищу.
 */

import { migrate, MIGRATIONS, type Migrations } from './migrations'
import { appDataSchema, appSettingsSchema, CURRENT_SCHEMA_VERSION } from './schema'
import type { AppData } from './types'

export function createAppData(): AppData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    games: [],
    appSettings: appSettingsSchema.parse({}),
  }
}

export interface DataIssue {
  path: string
  message: string
}

export type LoadResult =
  | { kind: 'ok'; data: AppData; migratedFrom: number | null }
  | { kind: 'newer'; version: number }
  | { kind: 'corrupted'; issues: DataIssue[] }

export function parseAppData(text: string, steps: Migrations = MIGRATIONS): LoadResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { kind: 'corrupted', issues: [{ path: '', message: String(e) }] }
  }

  const migrated = migrate(raw, steps)
  if (migrated.kind === 'newer') return migrated
  if (migrated.kind === 'invalid') {
    return { kind: 'corrupted', issues: [{ path: 'schemaVersion', message: migrated.reason }] }
  }

  const parsed = appDataSchema.safeParse(migrated.data)
  if (!parsed.success) {
    return {
      kind: 'corrupted',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    }
  }
  return {
    kind: 'ok',
    data: parsed.data,
    migratedFrom: migrated.migrated ? migrated.fromVersion : null,
  }
}

export function serializeAppData(data: AppData): string {
  return `${JSON.stringify(data, null, 2)}\n`
}
