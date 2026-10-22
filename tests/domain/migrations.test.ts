import { describe, expect, it } from 'vitest'
import { parseAppData, serializeAppData } from '@/domain/app-data'
import { migrate, MIGRATIONS, type Migrations } from '@/domain/migrations'
import { CURRENT_SCHEMA_VERSION } from '@/domain/schema'
import { sampleData } from '../fixtures'

describe('migrate', () => {
  it('leaves current data as is', () => {
    const r = migrate({ schemaVersion: CURRENT_SCHEMA_VERSION, games: [] })
    expect(r).toMatchObject({ kind: 'ok', migrated: false, fromVersion: CURRENT_SCHEMA_VERSION })
  })

  it('has a step for every version below the current one', () => {
    for (let v = 1; v < CURRENT_SCHEMA_VERSION; v++) expect(MIGRATIONS[v]).toBeDefined()
  })

  it('example: v1 → v2 renames a field and bumps schemaVersion', () => {
    const steps: Migrations = {
      1: ({ settings, ...rest }) => ({ ...rest, appSettings: settings }),
    }
    const r = migrate({ schemaVersion: 1, games: [], settings: { theme: 'dark' } }, steps, 2)
    expect(r).toEqual({
      kind: 'ok',
      fromVersion: 1,
      migrated: true,
      data: { schemaVersion: 2, games: [], appSettings: { theme: 'dark' } },
    })
  })

  it('applies steps in order across several versions', () => {
    const log: number[] = []
    const steps: Migrations = {
      1: (d) => (log.push(1), { ...d, a: 1 }),
      2: (d) => (log.push(2), { ...d, b: 2 }),
    }
    const r = migrate({ schemaVersion: 1 }, steps, 3)
    expect(log).toEqual([1, 2])
    expect(r).toMatchObject({ kind: 'ok', data: { schemaVersion: 3, a: 1, b: 2 } })
  })

  it('does not touch data from a newer app version', () => {
    expect(migrate({ schemaVersion: 5 }, {}, 1)).toEqual({ kind: 'newer', version: 5 })
  })

  it('rejects missing version, non-objects and gaps in steps', () => {
    expect(migrate({ games: [] })).toEqual({ kind: 'invalid', reason: 'no-version' })
    expect(migrate({ schemaVersion: 0 })).toEqual({ kind: 'invalid', reason: 'no-version' })
    expect(migrate([1, 2])).toEqual({ kind: 'invalid', reason: 'not-object' })
    expect(migrate({ schemaVersion: 1 }, {}, 2)).toEqual({ kind: 'invalid', reason: 'no-step' })
  })
})

describe('parseAppData', () => {
  it('round-trips serialized data', () => {
    const data = sampleData()
    expect(parseAppData(serializeAppData(data))).toEqual({ kind: 'ok', data, migratedFrom: null })
  })

  it('reports broken JSON and schema errors as corrupted', () => {
    expect(parseAppData('{"schemaVersion": 1, "ga').kind).toBe('corrupted')
    const r = parseAppData(JSON.stringify({ schemaVersion: 1, games: [{ name: '' }] }))
    expect(r.kind).toBe('corrupted')
    if (r.kind === 'corrupted') expect(r.issues[0]?.path).toMatch(/^games\.0/)
  })

  it('reports data from a newer version', () => {
    expect(parseAppData('{"schemaVersion": 99}')).toEqual({ kind: 'newer', version: 99 })
  })
})
