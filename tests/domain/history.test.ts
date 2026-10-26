import { describe, expect, it } from 'vitest'
import { focusAfterHistory } from '@/domain/history'
import type { AppData, Game } from '@/domain/types'
import { at, sampleData, sampleGame } from '../fixtures'

const P1 = '66666666-6666-4666-8666-666666666661'
const P2 = '66666666-6666-4666-8666-666666666662'

/** PUBG с двумя профилями и Dota 2; текущая — PUBG, профиль P1 */
function twoGames(): AppData {
  const pubg = sampleGame()
  const second = { ...at(pubg.profiles, 0), id: P2, name: 'Второй' }
  const withTwo = { ...pubg, profiles: [...pubg.profiles, second] }
  const dota = { ...sampleGame(), id: '11111111-1111-4111-8111-111111111112', name: 'Dota 2' }
  const data = sampleData()
  return {
    ...data,
    games: [withTwo, dota],
    appSettings: { ...data.appSettings, lastGameId: pubg.id, lastProfileId: P1 },
  }
}

const rename = (game: Game, name: string): Game => ({ ...game, name })

describe('focusAfterHistory (FR-24)', () => {
  it('stays put when the change is in the current game and profile', () => {
    const data = twoGames()
    const after = [rename(at(data.games, 0), 'PUBG 2'), at(data.games, 1)]
    expect(focusAfterHistory(data, after)).toEqual({})
  })

  it('switches to another game that changed', () => {
    const data = twoGames()
    const dota = at(data.games, 1)
    const after = [at(data.games, 0), rename(dota, 'Dota')]
    expect(focusAfterHistory(data, after)).toEqual({
      lastGameId: dota.id,
      lastProfileId: at(dota.profiles, 0).id,
    })
  })

  it('switches to another profile of the current game that changed', () => {
    const data = twoGames()
    const pubg = at(data.games, 0)
    const changed = { ...at(pubg.profiles, 1), notes: 'новое' }
    const after = [{ ...pubg, profiles: [at(pubg.profiles, 0), changed] }, at(data.games, 1)]
    expect(focusAfterHistory(data, after)).toEqual({ lastGameId: pubg.id, lastProfileId: P2 })
  })

  it('opens the neighbour when the current game disappears', () => {
    const data = twoGames()
    const dota = at(data.games, 1)
    expect(focusAfterHistory(data, [dota])).toEqual({
      lastGameId: dota.id,
      lastProfileId: at(dota.profiles, 0).id,
    })
    expect(focusAfterHistory(data, [])).toEqual({})
  })

  it('opens the neighbour profile when the current one disappears', () => {
    const data = { ...twoGames() }
    data.appSettings = { ...data.appSettings, lastProfileId: P2 }
    const pubg = at(data.games, 0)
    const after = [{ ...pubg, profiles: [at(pubg.profiles, 0)] }, at(data.games, 1)]
    // Игра изменилась, профиль P2 пропал — открывается P1
    expect(focusAfterHistory(data, after)).toEqual({ lastGameId: pubg.id, lastProfileId: P1 })
  })
})
