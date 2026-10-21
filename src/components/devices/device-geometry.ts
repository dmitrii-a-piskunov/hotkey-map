import type { Rect } from '@/domain/geometry'
import type { KeyboardLayout, KeyDef } from '@/layouts/aula-f75'
import { deviceTheme } from '@/styles/device-theme'

const { case: caseTheme, cap } = deviceTheme

/** Ширина корпуса вместе с полями, в юнитах */
export function keyboardWidth(layout: KeyboardLayout): number {
  return caseTheme.bezel.left + layout.width + caseTheme.bezel.right
}

/**
 * Подложки под группами клавиш: Esc, три группы F и основной блок.
 * Группа ряда F кончается там, где между клавишами есть зазор.
 */
export function keyWells(layout: KeyboardLayout): Rect[] {
  const fRow = layout.keys.filter((k) => k.profileRow === 'F').sort((a, b) => a.x - b.x)
  const rest = layout.keys.filter((k) => k.profileRow !== 'F')
  const groups: KeyDef[][] = []
  for (const k of fRow) {
    const last = groups.at(-1)?.at(-1)
    if (last && k.x - (last.x + last.w) < cap.gap) groups.at(-1)?.push(k)
    else groups.push([k])
  }
  if (rest.length > 0) groups.push(rest)
  return groups.map((g) => {
    const x = Math.min(...g.map((k) => k.x))
    const y = Math.min(...g.map((k) => k.y))
    return {
      x,
      y,
      w: Math.max(...g.map((k) => k.x + k.w)) - x,
      h: Math.max(...g.map((k) => k.y + k.h)) - y,
    }
  })
}

/** Отступы верхней грани от основания, в юнитах */
export interface Insets {
  left: number
  right: number
  top: number
  bottom: number
}

/**
 * Сдвиг верхней грани наружу от центра клавиатуры, в юнитах.
 * cx — центр клавиши или регулятора, width — ширина области клавиш.
 */
export function perspectiveShift(cx: number, width: number): number {
  const { perspectiveShift: k, topInsetSide } = deviceTheme.view3d.capShape3d
  const t = Math.min(1, Math.max(-1, (cx / width - 0.5) * 2))
  return t * k * topInsetSide
}

/**
 * Верхняя грань клавиши в 3D: усечённая пирамида по capShape3d, грань
 * сдвинута наружу по перспективе.
 */
export function capTopInsets3d(key: KeyDef, width: number): Insets {
  const shape = deviceTheme.view3d.capShape3d
  const dx = perspectiveShift(key.x + key.w / 2, width)
  return {
    left: shape.topInsetSide + dx,
    right: shape.topInsetSide - dx,
    top: shape.topInsetTop,
    bottom: shape.topInsetBottom,
  }
}

/**
 * Наклон верхней грани по ряду профиля (view3d.profileTilt), в юнитах:
 * на сколько задний край грани выше середины, а передний — ниже.
 * Наклон к пользователю опускает передний край, и передняя грань короче.
 */
export function capTiltRise(key: KeyDef): number {
  const { capShape3d: shape, profileTilt } = deviceTheme.view3d
  const depth = key.h - shape.topInsetTop - shape.topInsetBottom
  return (Math.tan((profileTilt[key.profileRow] * Math.PI) / 180) * depth) / 2
}
