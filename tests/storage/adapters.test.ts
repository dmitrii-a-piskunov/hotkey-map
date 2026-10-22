import { createStore } from 'idb-keyval'
import { beforeEach, describe, expect, it } from 'vitest'
import { backupFileName, sortBackups } from '@/storage/backup-names'
import { FileSystemStorage } from '@/storage/file-system-storage'
import { IndexedDbStorage } from '@/storage/indexed-db-storage'
import { StorageError, type StorageAdapter } from '@/storage/storage-adapter'
import { asHandle, memoryFolder } from '../mocks/memory-fs'

let dbCounter = 0
const freshIdb = () => new IndexedDbStorage(createStore(`adapters-${++dbCounter}`, 'kv'))

const at = (h: number, m = 0, s = 0) => new Date(2026, 9, 22, h, m, s)

describe('backup names', () => {
  it('uses local date and time and avoids collisions', () => {
    const d = at(9, 5, 7)
    expect(backupFileName(d, [])).toBe('data-2026-10-22_09-05-07.json')
    expect(backupFileName(d, ['data-2026-10-22_09-05-07.json'])).toBe(
      'data-2026-10-22_09-05-07-2.json',
    )
  })

  it('sorts newest first and skips foreign files', () => {
    const names = [
      'data-2026-10-22_09-00-00.json',
      'damaged-2026-10-22_12-00-00.json',
      'notes.txt',
      'data-2026-10-22_11-00-00.json',
      'data-2026-10-22_11-00-00-2.json',
    ]
    expect(sortBackups(names).map((b) => b.name)).toEqual([
      'data-2026-10-22_11-00-00-2.json',
      'data-2026-10-22_11-00-00.json',
      'data-2026-10-22_09-00-00.json',
    ])
  })
})

const adapters: [string, () => Promise<StorageAdapter>][] = [
  ['FileSystemStorage', () => FileSystemStorage.open(asHandle(memoryFolder()))],
  ['IndexedDbStorage', () => Promise.resolve(freshIdb())],
]

describe.each(adapters)('%s', (_, make) => {
  let storage: StorageAdapter
  beforeEach(async () => {
    storage = await make()
  })

  it('reads null before the first write and the text after it', async () => {
    expect(await storage.readData()).toBeNull()
    await storage.writeData('{"a":1}')
    expect(await storage.readData()).toBe('{"a":1}')
    await storage.writeData('{"a":2}')
    expect(await storage.readData()).toBe('{"a":2}')
  })

  it('creates, lists, reads and prunes backups', async () => {
    for (let h = 1; h <= 7; h++) await storage.createBackup(`v${h}`, at(h))
    let list = await storage.listBackups()
    expect(list).toHaveLength(7)
    expect(list[0]?.createdAt).toEqual(at(7))

    await storage.pruneBackups(5)
    list = await storage.listBackups()
    expect(list.map((b) => b.createdAt.getHours())).toEqual([7, 6, 5, 4, 3])
    expect(await storage.readBackup(list[4]?.name ?? '')).toBe('v3')
  })

  it('keeps damaged files out of the backup list and pruning', async () => {
    for (let h = 1; h <= 5; h++) await storage.createBackup(`v${h}`, at(h))
    await storage.saveDamaged('{broken', at(8))
    await storage.pruneBackups(5)
    expect(await storage.listBackups()).toHaveLength(5)
  })

  it('fails to read a missing backup', async () => {
    await expect(storage.readBackup('data-2026-01-01_00-00-00.json')).rejects.toMatchObject({
      kind: 'not-found',
    })
    await expect(storage.readBackup('../data.json')).rejects.toBeInstanceOf(StorageError)
  })

  it('stores icons', async () => {
    expect(await storage.readIcon('dota.png')).toBeNull()
    await storage.writeIcon(
      'dota.png',
      new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
    )
    const icon = await storage.readIcon('dota.png')
    expect(icon?.type).toBe('image/png')
    expect(new Uint8Array((await icon?.arrayBuffer()) ?? new ArrayBuffer(0))).toEqual(
      new Uint8Array([1, 2, 3]),
    )
    await storage.deleteIcon('dota.png')
    await storage.deleteIcon('dota.png')
    expect(await storage.readIcon('dota.png')).toBeNull()
  })
})

describe('FileSystemStorage specifics', () => {
  it('creates data.json, icons/ and backups/ in the folder (scenario 1)', async () => {
    const folder = memoryFolder()
    const storage = await FileSystemStorage.open(asHandle(folder))
    await storage.writeData('{}')
    expect(folder.fileNames()).toEqual(['backups', 'data.json', 'icons'])
    expect(storage.folderName).toBe('hotkey-map-test')
  })

  it('reports a removed folder as not-found', async () => {
    const folder = memoryFolder()
    folder.removed = true
    await expect(FileSystemStorage.open(asHandle(folder))).rejects.toMatchObject({
      kind: 'not-found',
    })
  })

  it('reports a revoked permission', async () => {
    const folder = memoryFolder()
    const storage = await FileSystemStorage.open(asHandle(folder))
    folder.control.permission = 'prompt'
    await expect(storage.writeData('{}')).rejects.toMatchObject({ kind: 'permission' })
  })

  it('keeps the old data.json when a write fails (NFR-04)', async () => {
    const folder = memoryFolder()
    const storage = await FileSystemStorage.open(asHandle(folder))
    await storage.writeData('old')
    folder.control.failWrites = 1
    await expect(storage.writeData('new')).rejects.toMatchObject({ kind: 'io' })
    expect(await folder.readText('data.json')).toBe('old')
  })
})

describe('IndexedDbStorage specifics', () => {
  it('remembers when data first appeared in the browser', async () => {
    const storage = freshIdb()
    expect(await storage.createdAt()).toBeNull()
    await storage.writeData('{}')
    const first = await storage.createdAt()
    expect(first).toBeInstanceOf(Date)
    await storage.writeData('{"x":1}')
    expect(await storage.createdAt()).toEqual(first)
  })
})
