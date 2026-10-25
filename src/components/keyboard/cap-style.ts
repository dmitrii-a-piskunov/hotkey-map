import type { CSSProperties } from 'react'
import type { KeyDef } from '@/layouts/aula-f75'
import { shade } from '@/lib/color'
import { deviceTheme, type CapStyle, type KeyboardColor } from '@/styles/device-theme'

const { palettes, view3d } = deviceTheme
const PALETTES = Object.keys(palettes) as KeyboardColor[]
const STYLES: CapStyle[] = ['alpha', 'mod', 'accent']

/** Объект по каждой расцветке и стилю — строится один раз при загрузке модуля */
function byPalette<T>(make: (color: KeyboardColor, style: CapStyle) => T) {
  return Object.fromEntries(
    PALETTES.map((p) => [p, Object.fromEntries(STYLES.map((s) => [s, make(p, s)]))]),
  ) as Record<KeyboardColor, Record<CapStyle, T>>
}

export interface CapColors3d {
  topFar: string
  topNear: string
  frontTop: string
  frontBottom: string
  /** Левая грань */
  side: string
  /** Правая грань — чуть темнее левой */
  sideDark: string
}

export { KNOB_CODE } from '@/layouts/aula-f75'

/** Свет сверху в 3D: множители keyLighting к цвету верха клавиши */
export const CAP_COLORS_3D = byPalette<CapColors3d>((color, style) => {
  const top = palettes[color].caps[style].top
  const l = view3d.keyLighting
  return {
    topFar: shade(top, l.topFar),
    topNear: shade(top, l.topNear),
    frontTop: shade(top, l.frontTop),
    frontBottom: shade(top, l.frontBottom),
    side: shade(top, l.sides),
    sideDark: shade(top, l.sides * l.topNear),
  }
})

/**
 * CSS-переменные родной клавиши по расцветке и стилю — постоянные объекты,
 * чтобы не ломать memo у Key2D и Key3D
 */
export const CAP_VARS = byPalette<CSSProperties>((color, style) => {
  const c = palettes[color].caps[style]
  const c3 = CAP_COLORS_3D[color][style]
  return {
    '--cap-top': c.top,
    '--cap-side': c.side,
    '--cap-top-3d': `linear-gradient(${c3.topFar}, ${c3.topNear})`,
    '--cap-side-3d': c3.side,
    '--cap-side-dark-3d': c3.sideDark,
    '--legend': c.legend,
    '--legend-ru': c.legendRu,
  } as CSSProperties
})

/**
 * Диагональная штриховка для клика по неназначаемой клавише: так отказ не
 * спутать с выделением и цветами групп. Полоса — толщиной рамки конфликта.
 */
export function rejectHatch(width: number, cssUnit: 'px' | 'em'): string {
  const { color } = deviceTheme.state.conflict
  return `repeating-linear-gradient(45deg, ${color} 0 ${width}${cssUnit}, transparent ${width}${cssUnit} ${width * 3}${cssUnit})`
}

/**
 * Подсказка у неназначаемой клавиши: у нижнего ряда — под клавишей, у
 * остальных — над ней, чтобы не уходить за край клавиатуры. Регулятор — как
 * верхний ряд.
 */
export function hintPlacementOf(key: KeyDef): 'above' | 'below' {
  return key.profileRow === 'R5' ? 'below' : 'above'
}
