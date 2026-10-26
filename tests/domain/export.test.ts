import { describe, expect, it } from 'vitest'
import {
  buildExport,
  dataUrlBytes,
  exportFileName,
  exportIconNames,
  fileSlug,
  pngDataUrl,
  serializeExport,
} from '@/domain/export'
import { exportFileSchema } from '@/domain/schema'
import type { AppData } from '@/domain/types'
import { at, sampleData, sampleGame } from '../fixtures'

const NOW = new Date(2026, 9, 26, 12, 30)

/** Две игры, во второй два профиля и иконка */
function twoGames(): AppData {
  const data = sampleData()
  const pubg = at(data.games, 0)
  const second = {
    ...at(pubg.profiles, 0),
    id: '66666666-6666-4666-8666-666666666662',
    name: 'Тест',
  }
  const dota = {
    ...sampleGame(),
    id: '11111111-1111-4111-8111-111111111112',
    name: 'Dota 2',
    icon: 'dota-1234abcd.png',
    profiles: [at(pubg.profiles, 0), second],
  }
  return { ...data, games: [pubg, dota] }
}

describe('buildExport', () => {
  it('all: every game and app settings with the export date', () => {
    const data = twoGames()
    const file = buildExport(data, { scope: 'all' }, NOW)
    expect(file?.games).toEqual(data.games)
    expect(file?.appSettings?.lastExportAt).toBe(NOW.toISOString())
    expect(exportFileSchema.safeParse(file).success).toBe(true)
  })

  it('game: one game with all profiles and no app settings', () => {
    const data = twoGames()
    const file = buildExport(data, { scope: 'game', gameId: at(data.games, 1).id }, NOW)
    expect(file?.games).toEqual([at(data.games, 1)])
    expect(file?.appSettings).toBeUndefined()
    expect(exportFileSchema.safeParse(file).success).toBe(true)
  })

  it('profile: its game with dictionaries and only this profile', () => {
    const data = twoGames()
    const dota = at(data.games, 1)
    const profile = at(dota.profiles, 1)
    const file = buildExport(
      data,
      { scope: 'profile', gameId: dota.id, profileId: profile.id },
      NOW,
    )
    const game = at(file?.games ?? [], 0)
    expect(game.profiles).toEqual([profile])
    expect(game.actions).toEqual(dota.actions)
    expect(game.settingsTemplate).toEqual(dota.settingsTemplate)
    expect(exportFileSchema.safeParse(file).success).toBe(true)
  })

  it('returns null for a missing game or profile', () => {
    const data = twoGames()
    expect(buildExport(data, { scope: 'game', gameId: 'nope' }, NOW)).toBeNull()
    const gameId = at(data.games, 0).id
    expect(buildExport(data, { scope: 'profile', gameId, profileId: 'nope' }, NOW)).toBeNull()
  })
})

describe('export file name and icons', () => {
  it('names files after the game, the profile and the local date', () => {
    const data = twoGames()
    const dota = at(data.games, 1)
    const all = buildExport(data, { scope: 'all' }, NOW)
    const game = buildExport(data, { scope: 'game', gameId: dota.id }, NOW)
    const profile = buildExport(
      data,
      { scope: 'profile', gameId: dota.id, profileId: at(dota.profiles, 1).id },
      NOW,
    )
    if (!all || !game || !profile) throw new Error('no file')
    expect(exportFileName(all, NOW)).toBe('hotkeymap-2026-10-26.hotkeymap.json')
    expect(exportFileName(game, NOW)).toBe('dota-2-2026-10-26.hotkeymap.json')
    expect(exportFileName(profile, NOW)).toBe('dota-2-тест-2026-10-26.hotkeymap.json')
  })

  it('slugs drop characters Windows does not allow', () => {
    expect(fileSlug('PUBG: BATTLEGROUNDS')).toBe('pubg-battlegrounds')
    expect(fileSlug('  Мой / профиль?* ')).toBe('мой-профиль')
    expect(fileSlug('***')).toBe('')
  })

  it('lists each icon once', () => {
    const data = twoGames()
    const file = buildExport(data, { scope: 'all' }, NOW)
    if (!file) throw new Error('no file')
    expect(exportIconNames(file)).toEqual(['dota-1234abcd.png'])
  })

  it('round-trips icon bytes through a PNG data URL that the schema accepts', () => {
    const bytes = Uint8Array.from({ length: 70_000 }, (_, i) => (i * 31) % 256)
    const url = pngDataUrl(bytes)
    expect(dataUrlBytes(url)).toEqual(bytes)
    expect(dataUrlBytes('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull()
    expect(dataUrlBytes('data:image/png;base64,%%%')).toBeNull()

    const data = twoGames()
    const file = buildExport(data, { scope: 'all' }, NOW)
    if (!file) throw new Error('no file')
    const text = serializeExport({ ...file, icons: { 'dota-1234abcd.png': url } })
    expect(exportFileSchema.safeParse(JSON.parse(text)).success).toBe(true)
  })
})
