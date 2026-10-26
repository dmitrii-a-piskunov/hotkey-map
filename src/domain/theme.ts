/** Темы (FR-25): системная следует настройке Windows, светлая и тёмная — всегда свои */

import type { Theme } from './types'

export function resolveTheme(theme: Theme, systemDark: boolean): 'light' | 'dark' {
  if (theme === 'system') return systemDark ? 'dark' : 'light'
  return theme
}

export function isTheme(value: unknown): value is Theme {
  return value === 'system' || value === 'light' || value === 'dark'
}
