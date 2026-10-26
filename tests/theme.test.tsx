import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveTheme } from '@/domain/theme'
import { useDataStore } from '@/features/data/store'
import { THEME_KEY, useTheme } from '@/features/theme/use-theme'
import { sampleData } from './fixtures'

/** Подменённый prefers-color-scheme: dark со сменой «как в Windows» */
function fakeSystem(dark: boolean) {
  const listeners = new Set<() => void>()
  const query = {
    get matches() {
      return dark
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }
  window.matchMedia = (() => query) as unknown as typeof window.matchMedia
  return (next: boolean) => {
    dark = next
    for (const fn of listeners) fn()
  }
}

function Probe({ ready }: { ready: boolean }) {
  useTheme(ready)
  return null
}

const isDark = () => document.documentElement.classList.contains('dark')

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  useDataStore.getState().replaceData(sampleData())
})

afterEach(() => {
  localStorage.clear()
})

describe('themes (FR-25)', () => {
  it('resolves the system theme by the media query', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('applies the chosen theme and remembers it for the next launch', () => {
    fakeSystem(false)
    render(<Probe ready />)
    expect(isDark()).toBe(false)
    act(() => {
      useDataStore.getState().updateSettings({ theme: 'dark' })
    })
    expect(isDark()).toBe(true)
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
  })

  it('the system theme follows Windows without a reload', () => {
    const setSystem = fakeSystem(false)
    render(<Probe ready />)
    expect(isDark()).toBe(false)
    act(() => {
      setSystem(true)
    })
    expect(isDark()).toBe(true)
  })

  it('before data is loaded uses the theme of the last launch', () => {
    fakeSystem(false)
    localStorage.setItem(THEME_KEY, 'dark')
    render(<Probe ready={false} />)
    expect(isDark()).toBe(true)
    // Пока данные не загружены, копия не перезаписывается настройкой по умолчанию
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
  })
})
