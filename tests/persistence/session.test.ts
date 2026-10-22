import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { serializeAppData } from '@/domain/app-data'
import { useDataStore } from '@/features/data/store'
import {
  MAX_RETRIES,
  PersistenceSession,
  RETRY_DELAY_MS,
  SAVE_DELAY_MS,
} from '@/features/persistence/session'
import { usePersistenceStatus } from '@/features/persistence/status-store'
import { sampleData } from '../fixtures'
import { memoryFolder } from '../mocks/memory-fs'
import {
  makeTestEnv,
  phase,
  resetStores,
  settings,
  status,
  type TestEnv,
} from '../mocks/persistence-env'

// IndexedDB в fake-indexeddb работает на setImmediate, его не подменяем
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(new Date(2026, 9, 22, 12, 0, 0))
  resetStores()
})

let sessions: PersistenceSession[] = []
afterEach(() => {
  sessions.forEach((s) => {
    s.dispose()
  })
  sessions = []
  vi.useRealTimers()
})

/** Новый запуск приложения в том же окружении: store сбрасывается, данные читаются заново */
async function launch(t: TestEnv): Promise<PersistenceSession> {
  // Как при закрытии вкладки: незаписанное дописывается
  for (const s of sessions) {
    await s.flush()
    s.dispose()
  }
  resetStores()
  const session = new PersistenceSession(t.env)
  sessions.push(session)
  await session.start()
  return session
}

const dataJson = async (t: TestEnv) => {
  const text = await t.folder.readText('data.json')
  return text === null ? null : (JSON.parse(text) as ReturnType<typeof sampleData>)
}
const backupNames = (t: TestEnv) =>
  t.folder
    .dir('backups')
    .fileNames()
    .filter((n) => n.startsWith('data-'))

function change(view: '2d' | '3d' = '2d') {
  useDataStore.getState().updateSettings({ view })
}

describe('first launch (scenario 1, FR-19)', () => {
  it('asks for a folder, then creates data.json, icons/ and backups/', async () => {
    const t = makeTestEnv()
    const session = await launch(t)
    expect(phase()).toBe('first-run')

    await session.chooseFolder()
    expect(phase()).toBe('ready')
    expect(t.folder.fileNames()).toEqual(['backups', 'data.json', 'icons'])
    expect(await dataJson(t)).toMatchObject({ schemaVersion: 1, games: [] })
    expect(t.saved).not.toBeNull()
    expect(status()).toMatchObject({ mode: 'folder', folderName: 'hotkey-map-test' })
  })

  it('stays on the first-run screen when the picker is cancelled', async () => {
    const t = makeTestEnv()
    const session = await launch(t)
    t.pickCancelled = true
    await session.chooseFolder()
    expect(phase()).toBe('first-run')
  })

  it('opens existing data in the chosen folder without overwriting it', async () => {
    const t = makeTestEnv()
    t.folder.writeText('data.json', serializeAppData(sampleData()))
    const session = await launch(t)
    await session.chooseFolder()
    expect(useDataStore.getState().data.games[0]?.name).toBe('PUBG')
    expect(t.folder.control.writes).toBe(0)
  })

  it('opens the saved folder on the next launch without asking', async () => {
    const t = makeTestEnv()
    await (await launch(t)).chooseFolder()
    await launch(t)
    expect(phase()).toBe('ready')
  })
})

describe('autosave (FR-19)', () => {
  it('TC-11: a change is written after 1 s and survives a restart', async () => {
    const t = makeTestEnv({ savedFolder: true })
    await launch(t)
    expect(status().saveStatus).toBe('saved')

    change('2d')
    expect(status()).toMatchObject({ saveStatus: 'saving', dirty: true })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS - 1)
    expect((await dataJson(t))?.appSettings.view).toBe('3d')
    await vi.advanceTimersByTimeAsync(1)
    expect((await dataJson(t))?.appSettings.view).toBe('2d')
    expect(status()).toMatchObject({ saveStatus: 'saved', dirty: false })

    await launch(t)
    expect(settings().view).toBe('2d')
  })

  it('writes once for a burst of changes', async () => {
    const t = makeTestEnv({ savedFolder: true })
    await launch(t)
    const before = t.folder.control.writes
    change('2d')
    await vi.advanceTimersByTimeAsync(500)
    change('3d')
    await vi.advanceTimersByTimeAsync(500)
    change('2d')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    // Папка новая, копировать нечего: одна запись data.json
    expect(t.folder.control.writes - before).toBe(1)
  })

  it('flush writes immediately', async () => {
    const t = makeTestEnv({ savedFolder: true })
    const session = await launch(t)
    change('2d')
    await session.flush()
    expect((await dataJson(t))?.appSettings.view).toBe('2d')
  })

  it('ignores settings that do not change anything', async () => {
    const t = makeTestEnv({ savedFolder: true })
    await launch(t)
    change('3d')
    expect(status().dirty).toBe(false)
  })
})

describe('backups (FR-20)', () => {
  it('backs up data.json once per session, before the first write', async () => {
    const t = makeTestEnv({ savedFolder: true })
    await launch(t)
    expect(backupNames(t)).toEqual([]) // новая папка: копировать нечего

    await launch(t)
    expect(backupNames(t)).toEqual([]) // запуск без изменений копию не делает
    change('2d')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    change('3d')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(backupNames(t)).toHaveLength(1)
    // В копии — данные на момент запуска, до изменений
    const backup = await t.folder.dir('backups').readText(backupNames(t)[0] ?? '')
    expect(backup).toContain('"view": "3d"')
  })

  it('keeps only the last 5 backups', async () => {
    const t = makeTestEnv({ savedFolder: true })
    await launch(t)
    for (let i = 0; i < 7; i++) {
      await launch(t)
      change(i % 2 ? '3d' : '2d')
      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
      vi.setSystemTime(Date.now() + 60_000)
    }
    expect(backupNames(t)).toHaveLength(5)
  })
})

describe('write errors (section 13.1)', () => {
  it('retries every 5 s up to 3 times, then waits for «Повторить»', async () => {
    const t = makeTestEnv({ savedFolder: true })
    const session = await launch(t)
    // Копия и data.json: первая запись падает на копии, дальше — по одной записи
    t.folder.control.failWrites = 1 + MAX_RETRIES
    change('2d')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(status()).toMatchObject({ saveStatus: 'error', saveError: 'io' })

    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS * MAX_RETRIES)
    expect(status().saveStatus).toBe('error')
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS * 3)
    expect(status().saveStatus).toBe('error') // больше сам не пробует

    await session.retrySave()
    expect(status()).toMatchObject({ saveStatus: 'saved', saveError: null, dirty: false })
    expect((await dataJson(t))?.appSettings.view).toBe('2d')
  })

  it('recovers on an automatic retry', async () => {
    const t = makeTestEnv({ savedFolder: true })
    await launch(t)
    t.folder.control.failWrites = 1
    change('2d')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(status().saveStatus).toBe('error')
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)
    expect(status().saveStatus).toBe('saved')
  })

  it('keeps changes in memory when permission is revoked and saves after granting', async () => {
    const t = makeTestEnv({ savedFolder: true })
    const session = await launch(t)
    t.folder.control.permission = 'prompt'
    change('2d')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + RETRY_DELAY_MS * 4)
    expect(status()).toMatchObject({ saveStatus: 'error', saveError: 'permission', dirty: true })
    expect(settings().view).toBe('2d')

    await session.grantPermission()
    expect(status().saveStatus).toBe('saved')
    expect((await dataJson(t))?.appSettings.view).toBe('2d')
  })
})

describe('launch problems (section 13.1)', () => {
  it('shows «Разрешить доступ» when the browser asks again', async () => {
    const t = makeTestEnv({ savedFolder: true })
    await launch(t)
    t.folder.control.permission = 'prompt'
    const session = await launch(t)
    expect(phase()).toBe('need-permission')

    t.folder.control.grantOnRequest = false
    await session.grantPermission()
    expect(phase()).toBe('need-permission')

    t.folder.control.grantOnRequest = true
    await session.grantPermission()
    expect(phase()).toBe('ready')
  })

  it('reports a removed folder and lets choose another one', async () => {
    const t = makeTestEnv({ savedFolder: true })
    t.folder.removed = true
    const session = await launch(t)
    expect(phase()).toBe('folder-missing')

    t.folder = memoryFolder('new-folder')
    await session.chooseFolder()
    expect(phase()).toBe('ready')
    expect(status().folderName).toBe('new-folder')
  })

  it('does not open data from a newer app version', async () => {
    const t = makeTestEnv({ savedFolder: true })
    t.folder.writeText('data.json', '{"schemaVersion": 7, "games": []}')
    await launch(t)
    expect(usePersistenceStatus.getState().phase).toEqual({ name: 'newer', version: 7 })
    expect(t.folder.control.writes).toBe(0)
  })
})

describe('corrupted data.json (FR-20, NFR-05)', () => {
  async function corruptAfterBackups(t: TestEnv) {
    // Две сессии с изменениями дают две копии
    await launch(t)
    for (const view of ['2d', '3d'] as const) {
      await launch(t)
      change(view)
      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
      vi.setSystemTime(Date.now() + 60_000)
    }
    t.folder.writeText('data.json', '{"schemaVersion": 1, "games": [{"broken"')
  }

  it('TC-12: offers backups and does not overwrite the damaged file', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const t = makeTestEnv({ savedFolder: true })
    await corruptAfterBackups(t)
    const writes = t.folder.control.writes

    const session = await launch(t)
    const current = usePersistenceStatus.getState().phase
    expect(current.name).toBe('corrupted')
    if (current.name !== 'corrupted') return
    expect(current.backups).toHaveLength(2)
    expect(t.folder.control.writes).toBe(writes)

    // Самая свежая копия сделана во второй сессии, до изменения на 3d — там 2d
    await session.restoreBackup(current.backups[0]?.name ?? '')
    expect(phase()).toBe('ready')
    expect(settings().view).toBe('2d')
    expect((await dataJson(t))?.appSettings.view).toBe('2d')
    const files = t.folder.dir('backups').fileNames()
    expect(files.filter((n) => n.startsWith('damaged-'))).toHaveLength(1)
    expect(files.filter((n) => n.startsWith('data-'))).toHaveLength(2)
  })

  it('reports a damaged backup and stays on the screen', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const t = makeTestEnv({ savedFolder: true })
    await corruptAfterBackups(t)
    const backups = t.folder.dir('backups')
    const name = backups.fileNames()[0] ?? ''
    backups.writeText(name, 'not json')

    const session = await launch(t)
    await session.restoreBackup(name)
    expect(usePersistenceStatus.getState().phase).toMatchObject({
      name: 'corrupted',
      restoreFailed: name,
    })
  })

  it('can start with empty data, keeping the damaged file', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const t = makeTestEnv({ savedFolder: true })
    t.folder.writeText('data.json', 'garbage')
    const session = await launch(t)
    expect(phase()).toBe('corrupted')
    await session.startEmpty()
    expect(phase()).toBe('ready')
    expect(await dataJson(t)).toMatchObject({ games: [] })
    expect(
      await t.folder.dir('backups').readText(t.folder.dir('backups').fileNames()[0] ?? ''),
    ).toBe('garbage')
  })
})

describe('Firefox mode (FR-23)', () => {
  it('stores data in IndexedDB without asking for a folder', async () => {
    const t = makeTestEnv({ supported: false })
    await launch(t)
    expect(status()).toMatchObject({ mode: 'browser', phase: { name: 'ready' } })
    change('2d')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    await launch(t)
    expect(settings().view).toBe('2d')
    expect(t.folder.fileNames()).toEqual([])
  })

  it('reminds about export after 7 days without one', async () => {
    const t = makeTestEnv({ supported: false })
    await launch(t)
    expect(status().exportReminder).toBe(false)

    vi.setSystemTime(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const session = await launch(t)
    expect(status().exportReminder).toBe(true)
    session.dismissExportReminder()
    expect(status().exportReminder).toBe(false)

    useDataStore.getState().updateSettings({ lastExportAt: new Date().toISOString() })
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    await launch(t)
    expect(status().exportReminder).toBe(false)
  })

  it('never reminds in folder mode', async () => {
    const t = makeTestEnv({ savedFolder: true })
    await launch(t)
    vi.setSystemTime(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await launch(t)
    expect(status().exportReminder).toBe(false)
  })
})
