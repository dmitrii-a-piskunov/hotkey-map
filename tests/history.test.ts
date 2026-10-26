import { beforeEach, describe, expect, it } from 'vitest'
import { createAppData } from '@/domain/app-data'
import { HISTORY_LIMIT, useDataStore } from '@/features/data/store'
import { redoCmd, undoCmd } from '@/features/history/history'
import { sampleData, sampleGame } from './fixtures'

const store = () => useDataStore.getState()
const temporal = () => useDataStore.temporal.getState()
const names = () => store().data.games.map((g) => g.name)

function rename(name: string) {
  store().apply((d) => ({ ...d, games: d.games.map((g) => ({ ...g, name })) }))
}

beforeEach(() => {
  store().replaceData(sampleData())
})

describe('undo and redo (FR-24)', () => {
  it('loading data starts an empty history', () => {
    expect(temporal().pastStates).toHaveLength(0)
    expect(temporal().futureStates).toHaveLength(0)
  })

  it('undoes and redoes game changes', () => {
    rename('A')
    rename('B')
    undoCmd()
    expect(names()).toEqual(['A'])
    undoCmd()
    expect(names()).toEqual(['PUBG'])
    redoCmd()
    expect(names()).toEqual(['A'])
    rename('C')
    expect(temporal().futureStates).toHaveLength(0)
  })

  it('app settings are not steps and survive an undo', () => {
    rename('A')
    store().updateSettings({ theme: 'dark', view: '2d' })
    expect(temporal().pastStates).toHaveLength(1)
    undoCmd()
    expect(names()).toEqual(['PUBG'])
    expect(store().data.appSettings).toMatchObject({ theme: 'dark', view: '2d' })
  })

  it('a change that returns the same data is not a step', () => {
    store().apply((d) => d)
    expect(temporal().pastStates).toHaveLength(0)
  })

  it('keeps the last 50 steps', () => {
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) rename(`G${String(i)}`)
    expect(temporal().pastStates).toHaveLength(HISTORY_LIMIT)
  })

  it('switches to the game the undone change was in', () => {
    const dota = { ...sampleGame(), id: '11111111-1111-4111-8111-111111111112', name: 'Dota 2' }
    store().replaceData({ ...createAppData(), games: [sampleGame(), dota] })
    store().apply((d) => ({
      ...d,
      games: d.games.map((g) => (g.id === dota.id ? { ...g, name: 'Dota' } : g)),
    }))
    store().updateSettings({ lastGameId: sampleGame().id })
    undoCmd()
    expect(store().data.appSettings.lastGameId).toBe(dota.id)
  })
})
