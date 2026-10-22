import { describe, expect, it } from 'vitest'
import { createAppData } from '@/domain/app-data'
import { appDataSchema, appSettingsSchema, exportFileSchema } from '@/domain/schema'
import type { Game } from '@/domain/types'
import { ru } from '@/i18n/ru'
import dota2 from '@/presets/dota2.json'
import pubg from '@/presets/pubg.json'
import { at, sampleData, sampleGame } from '../fixtures'

function withGame(patch: (g: Game) => void) {
  const game = sampleGame()
  patch(game)
  return { ...createAppData(), games: [game] }
}

function messages(data: unknown): string[] {
  const r = appDataSchema.safeParse(data)
  return r.success ? [] : r.error.issues.map((i) => i.message)
}

const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999'

describe('appDataSchema', () => {
  it('accepts empty and sample data', () => {
    expect(appDataSchema.safeParse(createAppData()).success).toBe(true)
    expect(appDataSchema.safeParse(sampleData()).success).toBe(true)
  })

  it('fills appSettings defaults for partial or missing settings (appendix B)', () => {
    const parsed = appDataSchema.parse({
      schemaVersion: 1,
      games: [],
      appSettings: { theme: 'dark', labelLang: 'en', view: '3d', showLabels: true },
    })
    expect(parsed.appSettings).toMatchObject({
      theme: 'dark',
      labelLang: 'en',
      autoLang: true,
      colorMode: 'category',
      inputMode: 'check',
    })
    expect(appDataSchema.parse({ schemaVersion: 1, games: [] }).appSettings).toEqual(
      appSettingsSchema.parse({}),
    )
  })

  it('defaults blockedKeys and keyGroups', () => {
    const game = sampleGame()
    const raw = JSON.parse(JSON.stringify(game)) as Record<string, Record<string, unknown>>
    delete raw.rules?.blockedKeys
    const profiles = raw.profiles as unknown as Record<string, unknown>[]
    delete at(profiles, 0).keyGroups
    const parsed = appDataSchema.parse({ ...createAppData(), games: [raw] })
    const parsedGame = at(parsed.games, 0)
    expect(parsedGame.rules.blockedKeys).toEqual(['Fn', 'Knob'])
    expect(at(parsedGame.profiles, 0).keyGroups).toEqual([])
  })

  it('rejects wrong schemaVersion, bad colors and field limits', () => {
    expect(appDataSchema.safeParse({ ...createAppData(), schemaVersion: 2 }).success).toBe(false)
    expect(messages(withGame((g) => (at(g.categories, 0).color = 'blue')))).not.toEqual([])
    expect(messages(withGame((g) => (g.name = 'x'.repeat(61))))).not.toEqual([])
    expect(messages(withGame((g) => (g.rules.maxKeysPerAction = 3 as 1)))).not.toEqual([])
  })

  it('requires at least one profile', () => {
    expect(messages(withGame((g) => (g.profiles = [])))).not.toEqual([])
  })

  it('requires exactly one global context', () => {
    expect(messages(withGame((g) => (at(g.contexts, 1).isGlobal = true)))).toContain(
      ru.dataErrors.globalContext,
    )
  })

  it('checks references of actions and bindings', () => {
    const data = withGame((g) => {
      const action = at(g.actions, 0)
      action.contextId = UNKNOWN_ID
      action.categoryId = UNKNOWN_ID
      const binding = at(at(g.profiles, 0).bindings, 0)
      binding.actionId = UNKNOWN_ID
      binding.paramOptionId = UNKNOWN_ID
    })
    expect(messages(data)).toEqual([
      ru.dataErrors.unknownContext,
      ru.dataErrors.unknownCategory,
      ru.dataErrors.unknownAction,
      ru.dataErrors.unknownOption,
    ])
  })

  it('reports duplicate ids and game names', () => {
    const game = sampleGame()
    expect(messages({ ...createAppData(), games: [game, game] })).toEqual([
      ru.dataErrors.duplicateId,
      ru.dataErrors.duplicateGameName,
    ])
  })

  it('FR-29: an input belongs to at most one key group', () => {
    const group = (id: string, inputs: string[]) => ({
      id,
      name: 'Группа',
      color: '#22C55E',
      inputs,
    })
    const data = withGame((g) => {
      at(g.profiles, 0).keyGroups = [
        group('88888888-8888-4888-8888-888888888881', ['KeyW', 'KeyA']),
        group('88888888-8888-4888-8888-888888888882', ['KeyA']),
      ]
    })
    expect(messages(data)).toEqual([ru.dataErrors.inputInTwoGroups])
  })

  it('FR-15: extra keys for an action are a rule violation, not a data error', () => {
    const data = withGame((g) => {
      g.rules.maxKeysPerAction = 1
      at(g.profiles, 0).bindings.push({
        id: '77777777-7777-4777-8777-777777777772',
        actionId: at(g.actions, 0).id,
        input: { device: 'mouse', code: 'Mouse4', modifiers: ['ctrl'] },
        pressType: 'hold',
        slot: 2,
      })
    })
    expect(messages(data)).toEqual([])
  })

  it('rejects unknown mouse codes', () => {
    const data = withGame((g) => {
      at(at(g.profiles, 0).bindings, 0).input = {
        device: 'mouse',
        code: 'Mouse9' as 'Mouse4',
        modifiers: [],
      }
    })
    expect(messages(data)).not.toEqual([])
  })
})

describe('exportFileSchema', () => {
  it('accepts the Dota 2 and PUBG presets (preset: true)', () => {
    for (const preset of [dota2, pubg]) {
      const r = exportFileSchema.safeParse(preset)
      expect(r.success, JSON.stringify(r.error?.issues.slice(0, 3))).toBe(true)
      expect(r.data?.preset).toBe(true)
    }
  })
})
