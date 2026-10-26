/**
 * Миграции data.json по schemaVersion (ТЗ, раздел 9.3). Шаг с ключом N
 * переводит данные из версии N в N + 1. Шаги применяются по порядку до
 * текущей версии; если версия данных новее приложения, данные не трогаются.
 */

import { CURRENT_SCHEMA_VERSION } from './schema'

export type MigrationStep = (data: Record<string, unknown>) => Record<string, unknown>
export type Migrations = Readonly<Record<number, MigrationStep>>

/** Новый шаг — вместе с тестом (CLAUDE.md) */
export const MIGRATIONS: Migrations = {
  /**
   * 1 → 2: необязательные поля раскладки меню игры (колонки, подразделы,
   * короткие подписи, пояснения), тип настройки info, видимость клавиатуры
   * и мыши. Старые данные подходят без изменений
   */
  1: (data) => data,
  /** 2 → 3: расцветка клавиатуры в appSettings, по умолчанию «Стандартная» */
  2: (data) => data,
  /**
   * 3 → 4: файл экспорта получил объём «один профиль» и иконки в Base64
   * (FR-21). data.json не меняется
   */
  3: (data) => data,
}

export type MigrationResult =
  | { kind: 'ok'; data: Record<string, unknown>; fromVersion: number; migrated: boolean }
  | { kind: 'newer'; version: number }
  | { kind: 'invalid'; reason: 'not-object' | 'no-version' | 'no-step' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function migrate(
  raw: unknown,
  steps: Migrations = MIGRATIONS,
  current: number = CURRENT_SCHEMA_VERSION,
): MigrationResult {
  if (!isRecord(raw)) return { kind: 'invalid', reason: 'not-object' }
  const version = raw.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { kind: 'invalid', reason: 'no-version' }
  }
  if (version > current) return { kind: 'newer', version }

  let data = raw
  for (let v = version; v < current; v++) {
    const step = steps[v]
    if (!step) return { kind: 'invalid', reason: 'no-step' }
    data = { ...step(data), schemaVersion: v + 1 }
  }
  return { kind: 'ok', data, fromVersion: version, migrated: version < current }
}
