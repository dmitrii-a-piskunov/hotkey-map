import { describe, expect, it } from 'vitest'
import { createAppData } from '@/domain/app-data'
import { currentGame, currentProfile, selectGame, selectProfile } from '@/domain/current'
import {
  addGame,
  createGame,
  fillSteamAppId,
  copyGame,
  gameImpact,
  gameNameError,
  parseSteamAppId,
  removeGame,
  setGameIcon,
  setGeneral,
  updateGame,
} from '@/domain/games'
import { nameError, uniqueName } from '@/domain/names'
import { appDataSchema, exportFileSchema } from '@/domain/schema'
import type { AppData } from '@/domain/types'
import dota2 from '@/presets/dota2.json'
import { at, sampleData, sampleGame, T, testClock } from '../fixtures'

const LATER = '2026-10-23T10:00:00.000Z'

describe('names', () => {
  it('checks required, length and duplicates ignoring case and spaces', () => {
    expect(nameError('  ', 10)).toBe('required')
    expect(nameError('a'.repeat(11), 10)).toBe('tooLong')
    expect(nameError(' dota 2 ', 60, ['Dota 2'])).toBe('duplicate')
    expect(nameError('Dota 2', 60, ['PUBG'])).toBeNull()
  })

  it('makes a free name with a counter that fits the limit', () => {
    expect(uniqueName('Dota 2', ['PUBG'], 60)).toBe('Dota 2')
    expect(uniqueName('Dota 2', ['dota 2'], 60)).toBe('Dota 2 (2)')
    expect(uniqueName('Dota 2', ['Dota 2', 'Dota 2 (2)'], 60)).toBe('Dota 2 (3)')
    expect(uniqueName('abcdef', ['abcdef'], 8)).toBe('abcd (2)')
  })
})

describe('createGame (FR-05, 9.5)', () => {
  it('has the global context, an empty template and the main profile', () => {
    const game = createGame(testClock(), '  Dota 2 ')
    expect(game.name).toBe('Dota 2')
    expect(game.contexts).toEqual([
      expect.objectContaining({ name: 'Везде', isGlobal: true, order: 0 }),
    ])
    expect(game.settingsTemplate).toEqual([])
    expect(game.profiles.map((p) => p.name)).toEqual(['Основной'])
    expect(game.rules).toEqual({
      maxKeysPerAction: 1,
      allowedModifiers: ['ctrl', 'shift', 'alt'],
      blockedKeys: ['Fn', 'Knob'],
    })
    expect(appDataSchema.safeParse(addGame(createAppData(), game)).success).toBe(true)
  })

  it('adding a game makes it current with its profile', () => {
    const game = createGame(testClock(), 'Dota 2')
    const data = addGame(createAppData(), game)
    expect(data.appSettings.lastGameId).toBe(game.id)
    expect(data.appSettings.lastProfileId).toBe(at(game.profiles, 0).id)
  })

  it('names are unique among games', () => {
    const data = sampleData()
    expect(gameNameError(data, 'pubg')).toBe('duplicate')
    expect(gameNameError(data, 'PUBG', sampleGame().id)).toBeNull()
  })
})

describe('updateGame', () => {
  it('stamps updatedAt and keeps the data object when nothing changed', () => {
    const data = sampleData()
    const id = sampleGame().id
    expect(updateGame(data, id, (g) => g, LATER)).toBe(data)
    const next = updateGame(data, id, (g) => setGameIcon(g, 'x.png'), LATER)
    expect(at(next.games, 0)).toMatchObject({ icon: 'x.png', updatedAt: LATER })
    expect(updateGame(data, 'missing', (g) => ({ ...g, name: 'X' }), LATER)).toBe(data)
  })

  it('setGeneral keeps Fn and the knob blocked and orders modifiers', () => {
    const game = setGeneral(sampleGame(), {
      name: ' PUBG 2 ',
      steamAppId: 1,
      rules: { maxKeysPerAction: 1, allowedModifiers: ['alt', 'ctrl'], blockedKeys: ['MetaLeft'] },
    })
    expect(game.name).toBe('PUBG 2')
    expect(game.rules.allowedModifiers).toEqual(['ctrl', 'alt'])
    expect(game.rules.blockedKeys).toEqual(['Fn', 'Knob', 'MetaLeft'])
    // 13.2: смена правила с 2 на 1 не удаляет бинды
    expect(at(game.profiles, 0).bindings).toHaveLength(1)
  })

  it('parses the Steam AppID', () => {
    expect(parseSteamAppId('')).toEqual({ error: false })
    expect(parseSteamAppId(' 570 ')).toEqual({ value: 570, error: false })
    expect(parseSteamAppId('0').error).toBe(true)
    expect(parseSteamAppId('5.5').error).toBe(true)
    expect(parseSteamAppId('abc').error).toBe(true)
  })
})

describe('removeGame (9.2)', () => {
  it('counts what goes away', () => {
    expect(gameImpact(sampleGame())).toEqual({ profiles: 1, actions: 1, bindings: 1 })
  })

  it('removes the game and moves the selection to the next one', () => {
    const clock = testClock()
    const other = createGame(clock, 'Dota 2')
    let data: AppData = addGame(sampleData(), other)
    data = removeGame(data, other.id)
    expect(data.games.map((g) => g.name)).toEqual(['PUBG'])
    expect(data.appSettings.lastGameId).toBe(sampleGame().id)
    data = removeGame(data, sampleGame().id)
    expect(data.games).toEqual([])
    expect(data.appSettings.lastGameId).toBeUndefined()
    expect(appDataSchema.safeParse(data).success).toBe(true)
  })

  it('keeps the selection when another game is removed', () => {
    const other = createGame(testClock(), 'Dota 2')
    const data = addGame(sampleData(), other)
    expect(removeGame(data, sampleGame().id).appSettings.lastGameId).toBe(other.id)
  })
})

describe('current game and profile (8.2)', () => {
  it('falls back to the first game and profile', () => {
    const data = sampleData()
    const game = currentGame(data)
    expect(game?.name).toBe('PUBG')
    expect(game && currentProfile(game, data.appSettings)?.name).toBe('Основной')
    expect(currentGame(createAppData())).toBeUndefined()
  })

  it('selects a game with its first profile and a profile of a game', () => {
    const data = sampleData()
    const game = sampleGame()
    expect(selectGame(data, game.id)).toEqual({
      lastGameId: game.id,
      lastProfileId: at(game.profiles, 0).id,
    })
    expect(selectGame(data, 'missing')).toEqual({})
    expect(selectProfile(data, game.id, 'missing')).toEqual({})
  })
})

describe('copyGame (FR-21, FR-22)', () => {
  it('gives every entity a new id and keeps the references valid', () => {
    const preset = at(exportFileSchema.parse(dota2).games, 0)
    const clock = testClock(LATER)
    const game = copyGame(preset, clock, ['Dota 2'])
    expect(game.name).toBe('Dota 2 (2)')
    expect(game.id).not.toBe(preset.id)
    const oldIds = new Set([
      ...preset.contexts.map((c) => c.id),
      ...preset.categories.map((c) => c.id),
      ...preset.actions.map((a) => a.id),
    ])
    expect(game.actions.some((a) => oldIds.has(a.id) || oldIds.has(a.contextId))).toBe(false)
    expect(game.actions).toHaveLength(preset.actions.length)
    expect(game.createdAt).toBe(LATER)
    const data = addGame(createAppData(), game)
    expect(appDataSchema.safeParse(data).success).toBe(true)
  })

  it('remaps select values and bindings in profiles', () => {
    const base = sampleGame()
    const preset = {
      ...base,
      bindParam: {
        name: 'Режим',
        options: [{ id: '88888888-8888-4888-8888-888888888881', name: 'A' }],
      },
      settingsTemplate: [
        ...base.settingsTemplate,
        {
          id: '55555555-5555-4555-8555-555555555552',
          group: 'Графика',
          name: 'Качество',
          type: 'select' as const,
          options: [{ id: '99999999-9999-4999-8999-999999999991', name: 'Высокое' }],
          defaultValue: '99999999-9999-4999-8999-999999999991',
          order: 1,
        },
      ],
      profiles: base.profiles.map((p) => ({
        ...p,
        bindings: p.bindings.map((b) => ({
          ...b,
          paramOptionId: '88888888-8888-4888-8888-888888888881',
        })),
        settingValues: {
          ...p.settingValues,
          '55555555-5555-4555-8555-555555555552': '99999999-9999-4999-8999-999999999991',
        },
      })),
    }
    const game = copyGame(preset, testClock(), [])
    const data = addGame(createAppData(), game)
    expect(appDataSchema.safeParse(data).success).toBe(true)
    const select = at(game.settingsTemplate, 1)
    const profile = at(game.profiles, 0)
    expect(profile.settingValues[select.id]).toBe(select.type === 'select' && select.defaultValue)
    expect(at(profile.bindings, 0).paramOptionId).toBe(game.bindParam?.options[0]?.id)
    expect(profile.createdAt).toBe(T)
  })
})

describe('fillSteamAppId', () => {
  it('sets the AppID from a shortcut only when the game has none', () => {
    const game = { ...sampleGame(), steamAppId: undefined }
    expect(fillSteamAppId(game, 570).steamAppId).toBe(570)
    const withId = sampleGame()
    expect(fillSteamAppId(withId, 570)).toBe(withId)
  })
})
