/**
 * Вид каждого входа на сцене (FR-14, FR-15, FR-16, FR-26, FR-30): цвет
 * заливки, подпись действия, конфликт и приглушение. Считается для
 * клавиатуры и мыши вместе, компоненты только рисуют.
 */

import { useMemo, type CSSProperties } from 'react'
import { currentGame, currentProfile } from '@/domain/current'
import { paintInputs } from '@/domain/key-paint'
import { BASE_LAYER } from '@/domain/layers'
import { useBindingsUi } from '@/features/bindings/ui-store'
import { useCurrentIssues } from '@/features/bindings/use-bindings'
import { useDataStore, useSettings } from '@/features/data/store'
import { ru } from '@/i18n/ru'
import { isLight, shade } from '@/lib/color'
import { deviceTheme } from '@/styles/device-theme'

const { paint, view3d } = deviceTheme

export interface InputView {
  /** CSS-переменные цвета клавиши; нет — родной цвет клавиши */
  style?: CSSProperties
  /** Цвета заливки по порядку (полоски) */
  colors: string[]
  /** Подпись действия, если подписи включены */
  label?: string
  title?: string
  extra: number
  conflict: boolean
  dimmed: boolean
}

export const PLAIN_VIEW: InputView = { colors: [], extra: 0, conflict: false, dimmed: false }
const DIMMED_VIEW: InputView = { ...PLAIN_VIEW, dimmed: true }

/** Полоски слева направо, равной ширины */
export function stripes(colors: readonly string[], direction = '90deg'): string {
  if (colors.length === 1) return colors[0] ?? 'transparent'
  const step = 100 / colors.length
  const stops = colors.map(
    (c, i) => `${c} ${(i * step).toFixed(2)}% ${((i + 1) * step).toFixed(2)}%`,
  )
  return `linear-gradient(${direction}, ${stops.join(', ')})`
}

const styleCache = new Map<string, CSSProperties>()

/**
 * Переменные клавиши в цвете: верх — цвет или полоски, грани — темнее по
 * первому цвету, подписи — по яркости первого цвета. Постоянные объекты,
 * чтобы не ломать memo клавиш.
 */
export function paintStyle(colors: readonly string[]): CSSProperties | undefined {
  const first = colors[0]
  if (!first) return undefined
  const key = colors.join(',')
  const cached = styleCache.get(key)
  if (cached) return cached
  const legend = isLight(first) ? paint.legendDark : paint.legendLight
  const l = view3d.keyLighting
  const top = stripes(colors)
  // В 3D свет сверху — прозрачный градиент поверх цвета
  const light = `linear-gradient(rgb(255 255 255 / ${((l.topFar - 1) * 100).toFixed(0)}%), rgb(0 0 0 / ${((1 - l.topNear) * 100).toFixed(0)}%))`
  const style = {
    '--cap-top': top,
    '--cap-side': shade(first, paint.side2d),
    '--cap-top-3d': `${light}, ${top}`,
    '--cap-side-3d': shade(first, paint.sides3d),
    '--cap-side-dark-3d': shade(first, paint.sides3d * l.topNear),
    '--cap-front-3d': shade(first, paint.front3d),
    '--legend': legend,
    '--legend-ru': `color-mix(in srgb, ${legend} ${paint.secondaryOpacity * 100}%, transparent)`,
  } as CSSProperties
  styleCache.set(key, style)
  return style
}

/** Виды входов текущего профиля в текущем слое */
export function useInputViews(): ReadonlyMap<string, InputView> {
  const data = useDataStore((s) => s.data)
  const issues = useCurrentIssues()
  const layer = useBindingsUi((s) => s.layer)
  const highlight = useBindingsUi((s) => s.highlight)
  const colorMode = useSettings((s) => s.colorMode)
  const showLabels = useSettings((s) => s.showLabels)
  const game = currentGame(data)
  const profile = game && currentProfile(game, data.appSettings)

  return useMemo(() => {
    const views = new Map<string, InputView>()
    if (!game || !profile) return views
    const painted = paintInputs({ game, profile, layer, colorMode, issues })
    const lit = highlight ? new Set(highlight.codes) : null
    for (const [code, p] of painted) {
      const colors = p.colors.map((c) => c ?? paint.uncategorized)
      views.set(code, {
        style: paintStyle(colors),
        colors,
        label: showLabels ? p.label : undefined,
        title: p.title,
        extra: showLabels ? p.extra : 0,
        conflict: p.conflict,
        // FR-14: в слое с модификатором свободные клавиши приглушены; FR-16: поиск
        // приглушает всё, кроме клавиш действия, и в основном слое
        dimmed: lit ? !lit.has(code) : layer !== BASE_LAYER && !p.bound,
      })
    }
    // Остальные входы: приглушены в слое с модификатором и при поиске
    if (lit || layer !== BASE_LAYER) views.set('*', DIMMED_VIEW)
    return views
  }, [game, profile, layer, colorMode, issues, highlight, showLabels])
}

/** Вид входа: свой или общий для свободных */
export function viewOf(views: ReadonlyMap<string, InputView>, code: string): InputView {
  return views.get(code) ?? views.get('*') ?? PLAIN_VIEW
}

/** Подпись клавиши для экранного диктора: клавиша, действие, конфликт */
export function keyAriaLabel(name: string, off: boolean, view: InputView): string {
  const parts = [name]
  if (off) parts.push(ru.devices.notAssignable)
  if (view.title) parts.push(view.title)
  if (view.conflict) parts.push(ru.bindings.conflict)
  return parts.join('. ')
}
