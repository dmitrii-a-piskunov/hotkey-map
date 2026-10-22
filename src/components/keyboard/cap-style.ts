import type { CSSProperties } from 'react'
import type { KeyDef } from '@/layouts/aula-f75'
import { shade } from '@/lib/color'
import { deviceTheme, type CapStyle } from '@/styles/device-theme'

const { caps, view3d } = deviceTheme

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
export const CAP_COLORS_3D = Object.fromEntries(
  (Object.keys(caps) as CapStyle[]).map((name) => {
    const top = caps[name].top
    const l = view3d.keyLighting
    return [
      name,
      {
        topFar: shade(top, l.topFar),
        topNear: shade(top, l.topNear),
        frontTop: shade(top, l.frontTop),
        frontBottom: shade(top, l.frontBottom),
        side: shade(top, l.sides),
        sideDark: shade(top, l.sides * l.topNear),
      },
    ]
  }),
) as Record<CapStyle, CapColors3d>

/** CSS-переменные клавиши одного стиля — постоянные объекты, чтобы не ломать memo */
export const CAP_VARS = Object.fromEntries(
  (Object.keys(caps) as CapStyle[]).map((name) => {
    const c = caps[name]
    const c3 = CAP_COLORS_3D[name]
    return [
      name,
      {
        '--cap-top': c.top,
        '--cap-side': c.side,
        '--cap-top-3d': `linear-gradient(${c3.topFar}, ${c3.topNear})`,
        '--cap-side-3d': c3.side,
        '--cap-side-dark-3d': c3.sideDark,
        '--legend': c.legend,
        '--legend-ru': c.legendRu,
      } as CSSProperties,
    ]
  }),
) as Record<CapStyle, CSSProperties>

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
