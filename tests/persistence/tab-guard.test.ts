import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDataStore } from '@/features/data/store'
import { PersistenceSession } from '@/features/persistence/session'
import { broadcastTabGuard } from '@/features/persistence/tab-guard'
import { serializeAppData } from '@/domain/app-data'
import { sampleData } from '../fixtures'
import { makeTestEnv, resetStores, status } from '../mocks/persistence-env'

describe('broadcastTabGuard (FR-27)', () => {
  it('the first tab writes, the next ones only view', async () => {
    expect(await broadcastTabGuard(30).otherTabOpen()).toBe(false)
    expect(await broadcastTabGuard(30).otherTabOpen()).toBe(true)
    // Вкладка для просмотра не отвечает, но первая всё ещё отвечает
    expect(await broadcastTabGuard(30).otherTabOpen()).toBe(true)
  })
})

describe('read-only tab (FR-27)', () => {
  let session: PersistenceSession | null = null

  beforeEach(() => {
    resetStores()
  })
  afterEach(() => {
    session?.dispose()
    session = null
    vi.useRealTimers()
  })

  it('shows the data, applies no changes and writes nothing', async () => {
    const t = makeTestEnv({ savedFolder: true, otherTab: true })
    const text = serializeAppData(sampleData())
    t.folder.writeText('data.json', text)
    session = new PersistenceSession(t.env)
    await session.start()

    expect(status()).toMatchObject({ phase: { name: 'ready' }, readOnly: true })
    expect(useDataStore.getState().data.games).toHaveLength(1)

    vi.useFakeTimers()
    useDataStore.getState().apply((d) => ({ ...d, games: [] }))
    expect(useDataStore.getState().data.games).toHaveLength(1)
    useDataStore.getState().updateSettings({ view: '2d' })
    await vi.advanceTimersByTimeAsync(5000)

    expect(await t.folder.readText('data.json')).toBe(text)
    expect(t.folder.dir('backups').fileNames()).toEqual([])
    await expect(session.writeIcon('a.png', new Blob(['x']))).rejects.toThrow()
  })

  it('does not create data.json in an empty folder', async () => {
    const t = makeTestEnv({ savedFolder: true, otherTab: true })
    session = new PersistenceSession(t.env)
    await session.start()
    expect(status().phase.name).toBe('ready')
    expect(t.folder.fileNames()).not.toContain('data.json')
  })
})
