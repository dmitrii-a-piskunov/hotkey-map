/**
 * Картинки иконок для интерфейса: файл из icons/ читается через сессию
 * хранения один раз и живёт в памяти как object URL. Компоненты к
 * хранилищу не обращаются (CLAUDE.md).
 */

import { useEffect } from 'react'
import { create } from 'zustand'
import { systemClock } from '@/domain/clock'
import { iconFileName } from '@/domain/icons'
import { usePersistence } from '@/features/persistence/persistence-context'
import type { PersistenceSession } from '@/features/persistence/session'
import { setGameIconCmd } from './commands'

interface IconCache {
  /** null — файла нет */
  urls: Record<string, string | null>
}

const useIconCache = create<IconCache>()(() => ({ urls: {} }))
const loading = new Set<string>()

function put(name: string, url: string | null): void {
  useIconCache.setState((s) => ({ urls: { ...s.urls, [name]: url } }))
}

/** Адрес картинки иконки или null, пока она не загружена или если файла нет */
export function useIconUrl(name: string | undefined): string | null {
  const session = usePersistence()
  const url = useIconCache((s) => (name === undefined ? null : (s.urls[name] ?? null)))
  const known = useIconCache((s) => name !== undefined && name in s.urls)

  useEffect(() => {
    if (name === undefined || known || loading.has(name)) return
    loading.add(name)
    void session
      .readIcon(name)
      .then((blob) => {
        put(name, blob ? URL.createObjectURL(blob) : null)
      })
      .finally(() => loading.delete(name))
  }, [name, known, session])

  return url
}

/** Записывает PNG в icons/ под новым именем и ставит его игре */
export async function saveGameIcon(
  session: PersistenceSession,
  gameId: string,
  png: Blob,
): Promise<void> {
  const name = iconFileName(gameId, systemClock.id())
  await session.writeIcon(name, png)
  put(name, URL.createObjectURL(png))
  setGameIconCmd(gameId, name)
}
