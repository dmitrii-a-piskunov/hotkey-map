/**
 * Темы (FR-25): класс .dark на <html>. Выбор хранится в appSettings.theme;
 * копия в localStorage нужна только для первой отрисовки до загрузки
 * данных (скрипт в index.html), чтобы тёмная тема не мигала светлой.
 */

import { useEffect, useSyncExternalStore } from 'react'
import { isTheme, resolveTheme } from '@/domain/theme'
import type { Theme } from '@/domain/types'
import { useSettings } from '@/features/data/store'

/** Тот же ключ читает скрипт в index.html */
export const THEME_KEY = 'hotkey-map:theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function darkQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null
}

function subscribe(onChange: () => void): () => void {
  const query = darkQuery()
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}

/** Тёмная ли тема в Windows; следит за сменой без перезагрузки */
export function useSystemDark(): boolean {
  return useSyncExternalStore(subscribe, () => darkQuery()?.matches ?? false)
}

export function cachedTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return isTheme(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

/** Применяет тему; ready — данные загружены, до этого — тема из прошлого запуска */
export function useTheme(ready: boolean): void {
  const saved = useSettings((s) => s.theme)
  const theme = ready ? saved : cachedTheme()
  const systemDark = useSystemDark()
  const dark = resolveTheme(theme, systemDark) === 'dark'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, [dark])

  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Без localStorage тема всё равно применится после загрузки данных
    }
  }, [ready, theme])
}
