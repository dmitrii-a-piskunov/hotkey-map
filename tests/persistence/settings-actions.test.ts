import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { serializeAppData } from '@/domain/app-data'
import type { AppData } from '@/domain/types'
import { useDataStore } from '@/features/data/store'
import { PersistenceSession } from '@/features/persistence/session'
import { at, sampleData, sampleGame } from '../fixtures'
import { memoryFolder, type MemoryDirHandle } from '../mocks/memory-fs'
import { makeTestEnv, resetStores, status, type TestEnv } from '../mocks/persistence-env'

let session: PersistenceSession | null = null

beforeEach(() => {
  resetStores()
})
afterEach(() => {
  session?.dispose()
  session = null
})

const data = () => useDataStore.getState().data
const names = () => data().games.map((g) => g.name)

function withIcon(): AppData {
  return { ...sampleData(), games: [{ ...sampleGame(), icon: 'pubg-1234abcd.png' }] }
}

async function open(t: TestEnv, initial: AppData = withIcon()): Promise<PersistenceSession> {
  t.folder.writeText('data.json', serializeAppData(initial))
  await t.folder.getDirectoryHandle('icons', { create: true })
  const icon = await t.folder.dir('icons').getFileHandle('pubg-1234abcd.png', { create: true })
  icon.data = new Blob(['png'])
  session = new PersistenceSession(t.env)
  await session.start()
  return session
}

function rename(name: string) {
  useDataStore.getState().apply((d) => ({ ...d, games: d.games.map((g) => ({ ...g, name })) }))
}

async function backupTexts(dir: MemoryDirHandle): Promise<string[]> {
  const backups = dir.dir('backups')
  return Promise.all(backups.fileNames().map(async (n) => (await backups.readText(n)) ?? ''))
}

describe('restore a backup from settings (FR-20)', () => {
  it('saves the current state to a backup first and clears the undo history', async () => {
    const t = makeTestEnv({ savedFolder: true })
    const s = await open(t)
    rename('Сейчас')
    await s.flush()
    const [first] = await s.listBackups()
    if (!first) throw new Error('no launch backup')
    rename('Ещё позже')

    expect(await s.restoreFromSettings(first.name)).toBe(true)
    expect(names()).toEqual(['PUBG'])
    expect(useDataStore.temporal.getState().pastStates).toHaveLength(0)
    expect((await backupTexts(t.folder)).some((x) => x.includes('Ещё позже'))).toBe(true)
    expect(await t.folder.readText('data.json')).toContain('"name": "PUBG"')
  })

  it('a broken backup changes nothing', async () => {
    const t = makeTestEnv({ savedFolder: true })
    const s = await open(t)
    rename('Сейчас')
    await s.flush()
    t.folder.dir('backups').writeText('data-2026-01-01_00-00-00.json', '{ broken')
    expect(await s.restoreFromSettings('data-2026-01-01_00-00-00.json')).toBe(false)
    expect(names()).toEqual(['Сейчас'])
  })
})

describe('change the data folder (FR-19)', () => {
  it('an empty folder gets the current data and icons', async () => {
    const t = makeTestEnv({ savedFolder: true })
    const s = await open(t)
    rename('Перенос')
    const next = memoryFolder('новая-папка')
    t.folder = next

    expect(await s.changeFolder()).toBe('moved')
    expect(status().folderName).toBe('новая-папка')
    expect(await next.readText('data.json')).toContain('Перенос')
    expect(next.dir('icons').fileNames()).toEqual(['pubg-1234abcd.png'])
    expect(t.saved).toBe(next)
    expect(useDataStore.temporal.getState().pastStates).toHaveLength(0)
  })

  it('the same folder is reported, a closed picker cancels', async () => {
    const t = makeTestEnv({ savedFolder: true })
    const s = await open(t)
    expect(await s.changeFolder()).toBe('same')
    t.pickCancelled = true
    expect(await s.changeFolder()).toBe('cancelled')
  })

  it('a folder with data: open it', async () => {
    const t = makeTestEnv({ savedFolder: true })
    const s = await open(t)
    const next = memoryFolder('с-данными')
    const other = { ...sampleData(), games: [{ ...sampleGame(), name: 'Dota 2' }] }
    next.writeText('data.json', serializeAppData(other))
    t.folder = next

    expect(await s.changeFolder()).toBe('has-data')
    expect(await s.finishFolderChange('open')).toBe('ok')
    expect(names()).toEqual(['Dota 2'])
    expect(status().folderName).toBe('с-данными')
    rename('Dota 2 изменена')
    await s.flush()
    expect(await next.readText('data.json')).toContain('Dota 2 изменена')
  })

  it('a folder with data: replace it, its data goes to a backup', async () => {
    const t = makeTestEnv({ savedFolder: true })
    const s = await open(t)
    const next = memoryFolder('с-данными')
    const other = { ...sampleData(), games: [{ ...at(sampleData().games, 0), name: 'Dota 2' }] }
    next.writeText('data.json', serializeAppData(other))
    t.folder = next

    expect(await s.changeFolder()).toBe('has-data')
    expect(await s.finishFolderChange('replace')).toBe('ok')
    expect(names()).toEqual(['PUBG'])
    expect(await next.readText('data.json')).toContain('"name": "PUBG"')
    expect((await backupTexts(next)).some((x) => x.includes('Dota 2'))).toBe(true)
  })

  it('a folder with broken data is not opened', async () => {
    const t = makeTestEnv({ savedFolder: true })
    const s = await open(t)
    const next = memoryFolder('битая')
    next.writeText('data.json', '{ broken')
    t.folder = next
    expect(await s.changeFolder()).toBe('has-data')
    expect(await s.finishFolderChange('open')).toBe('corrupted')
    expect(status().folderName).toBe('hotkey-map-test')
  })
})
