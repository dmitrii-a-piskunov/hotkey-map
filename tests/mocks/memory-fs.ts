/**
 * Папка в памяти с тем же интерфейсом, что FileSystemDirectoryHandle, —
 * ровно то, чем пользуется FileSystemStorage. Умеет имитировать отзыв
 * разрешения, удалённую папку и сбои записи.
 */

export interface MemoryFsControl {
  /** Состояние разрешения на папку */
  permission: PermissionState
  /** Ответ на requestPermission */
  grantOnRequest: boolean
  /** Сколько следующих записей упадёт с ошибкой */
  failWrites: number
  /** Сколько раз запись дошла до диска */
  writes: number
}

function domError(name: string): DOMException {
  return new DOMException(name, name)
}

/** Исключение внутри fn превращается в отклонённый промис, как у браузера */
function attempt<T>(fn: () => T): Promise<T> {
  return new Promise((resolve) => {
    resolve(fn())
  })
}

class MemoryFileHandle {
  readonly kind = 'file'
  readonly name: string
  data: Blob = new Blob([])
  readonly #dir: MemoryDirHandle

  constructor(name: string, dir: MemoryDirHandle) {
    this.name = name
    this.#dir = dir
  }

  getFile(): Promise<File> {
    this.#dir.check()
    return Promise.resolve(new File([this.data], this.name, { type: this.data.type }))
  }

  createWritable() {
    this.#dir.check()
    const chunks: BlobPart[] = []
    const control = this.#dir.control
    return Promise.resolve({
      write: (part: BlobPart) => {
        if (control.failWrites > 0) {
          control.failWrites--
          return Promise.reject(domError('InvalidStateError'))
        }
        chunks.push(part)
        return Promise.resolve()
      },
      // Как в браузере: содержимое подменяется только при закрытии
      close: () => {
        this.data = new Blob(chunks, { type: chunks[0] instanceof Blob ? chunks[0].type : '' })
        control.writes++
        return Promise.resolve()
      },
      abort: () => Promise.resolve(),
    })
  }
}

export class MemoryDirHandle {
  readonly kind = 'directory'
  readonly name: string
  readonly control: MemoryFsControl
  readonly entries = new Map<string, MemoryDirHandle | MemoryFileHandle>()
  readonly #parent: MemoryDirHandle | null
  removed = false

  constructor(name: string, control: MemoryFsControl, parent: MemoryDirHandle | null = null) {
    this.name = name
    this.control = control
    this.#parent = parent
  }

  check(): void {
    if (this.control.permission !== 'granted') throw domError('NotAllowedError')
    if (this.removed) throw domError('NotFoundError')
    this.#parent?.check()
  }

  getDirectoryHandle(name: string, options: { create?: boolean } = {}) {
    return attempt(() => {
      this.check()
      let entry = this.entries.get(name)
      if (!entry && options.create) {
        entry = new MemoryDirHandle(name, this.control, this)
        this.entries.set(name, entry)
      }
      if (!(entry instanceof MemoryDirHandle)) throw domError('NotFoundError')
      return entry
    })
  }

  getFileHandle(name: string, options: { create?: boolean } = {}) {
    return attempt(() => {
      this.check()
      let entry = this.entries.get(name)
      if (!entry && options.create) {
        entry = new MemoryFileHandle(name, this)
        this.entries.set(name, entry)
      }
      if (!(entry instanceof MemoryFileHandle)) throw domError('NotFoundError')
      return entry
    })
  }

  removeEntry(name: string) {
    return attempt(() => {
      this.check()
      if (!this.entries.delete(name)) throw domError('NotFoundError')
    })
  }

  async *keys(): AsyncGenerator<string> {
    this.check()
    await Promise.resolve()
    yield* [...this.entries.keys()]
  }

  queryPermission() {
    return Promise.resolve(this.control.permission)
  }

  requestPermission() {
    if (this.control.grantOnRequest) this.control.permission = 'granted'
    return Promise.resolve(this.control.permission)
  }

  // Помощники тестов: прямой доступ к файлам в обход разрешений

  fileNames(): string[] {
    return [...this.entries.keys()].sort()
  }

  dir(name: string): MemoryDirHandle {
    const entry = this.entries.get(name)
    if (!(entry instanceof MemoryDirHandle)) throw new Error(`No dir ${name}`)
    return entry
  }

  async readText(name: string): Promise<string | null> {
    const entry = this.entries.get(name)
    return entry instanceof MemoryFileHandle ? entry.data.text() : null
  }

  writeText(name: string, text: string): void {
    const file = new MemoryFileHandle(name, this)
    file.data = new Blob([text])
    this.entries.set(name, file)
  }
}

export function memoryFolder(name = 'hotkey-map-test'): MemoryDirHandle {
  return new MemoryDirHandle(name, {
    permission: 'granted',
    grantOnRequest: true,
    failWrites: 0,
    writes: 0,
  })
}

/** Мок подходит туда, где ждут настоящую папку */
export function asHandle(dir: MemoryDirHandle): FileSystemDirectoryHandle {
  return dir as unknown as FileSystemDirectoryHandle
}
