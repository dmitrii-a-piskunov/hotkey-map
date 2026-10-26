import { describe, expect, it } from 'vitest'
import { parseAppData } from '@/domain/app-data'
import { migrate } from '@/domain/migrations'
import { CURRENT_SCHEMA_VERSION, exportFileSchema } from '@/domain/schema'
import type { Game } from '@/domain/types'
import { at, sampleData, sampleGame, T } from '../fixtures'

const PNG = 'data:image/png;base64,iVBORw0KGgo='

function file(scope: string, games: Game[], extra: Record<string, unknown> = {}) {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, scope, exportedAt: T, games, ...extra }
}

describe('schema v4', () => {
  it('migrates v3 data.json without changes', () => {
    const data = sampleData()
    const result = parseAppData(JSON.stringify({ ...data, schemaVersion: 3 }))
    expect(result).toMatchObject({ kind: 'ok', migratedFrom: 3 })
    if (result.kind === 'ok') expect(result.data).toEqual(data)
  })

  it('migrates a v3 export file of one game to a valid v4 file', () => {
    const v3 = { ...file('game', [sampleGame()]), schemaVersion: 3 }
    const migrated = migrate(v3)
    expect(migrated.kind).toBe('ok')
    if (migrated.kind === 'ok') expect(exportFileSchema.safeParse(migrated.data).success).toBe(true)
  })

  it('accepts a profile export: one game with one profile and its icon', () => {
    const game = { ...sampleGame(), icon: 'pubg-1234abcd.png' }
    const r = exportFileSchema.safeParse(
      file('profile', [game], { icons: { 'pubg-1234abcd.png': PNG } }),
    )
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true)
    expect(at(r.data?.games ?? [], 0).profiles).toHaveLength(1)
  })

  it('rejects a profile export with two profiles and a game export with two games', () => {
    const game = sampleGame()
    const second = { ...at(game.profiles, 0), id: '99999999-9999-4999-8999-999999999999' }
    const twoProfiles = { ...game, profiles: [...game.profiles, second] }
    expect(exportFileSchema.safeParse(file('profile', [twoProfiles])).success).toBe(false)
    expect(exportFileSchema.safeParse(file('game', [twoProfiles])).success).toBe(true)

    const other = { ...game, id: '88888888-8888-4888-8888-888888888888', name: 'Другая' }
    expect(exportFileSchema.safeParse(file('game', [game, other])).success).toBe(false)
    expect(exportFileSchema.safeParse(file('all', [game, other])).success).toBe(true)
  })

  it('rejects icons that are not PNG in Base64', () => {
    const game = sampleGame()
    for (const icon of ['data:image/svg+xml;base64,PHN2Zz4=', 'not a data url']) {
      const r = exportFileSchema.safeParse(file('game', [game], { icons: { 'a.png': icon } }))
      expect(r.success).toBe(false)
    }
  })
})
