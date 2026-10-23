/**
 * Как выглядит каждый вход в слое (FR-14, FR-26, FR-30): заливка по
 * категориям или по группам, подпись действия, конфликт. Цвета не
 * смешиваются: в режиме групп категории не видны на клавишах.
 */

import type { ProfileIssues } from './conflicts'
import { layerOf } from './layers'
import type { Action, Binding, ColorMode, Game, Profile } from './types'

/** Подпись на клавише — до 10 символов, остальное многоточием */
export const LABEL_MAX = 10

export interface InputPaint {
  /**
   * Цвета заливки: по категориям — по одному на категорию действий
   * (null — действие без категории), по группам — цвет группы.
   */
  colors: (string | null)[]
  /** Короткое название первого действия */
  label?: string
  /** Полное название первого действия — для подсказки */
  title?: string
  /** Сколько ещё действий на входе: «+N» */
  extra: number
  /** На входе есть бинды в этом слое */
  bound: boolean
  conflict: boolean
}

export function shortLabel(name: string): string {
  const text = name.trim()
  return text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX - 1).trimEnd()}…` : text
}

export interface PaintOptions {
  game: Game
  profile: Profile
  layer: string
  colorMode: ColorMode
  issues: ProfileIssues
}

export function paintInputs({
  game,
  profile,
  layer,
  colorMode,
  issues,
}: PaintOptions): Map<string, InputPaint> {
  const actions = new Map(game.actions.map((a) => [a.id, a]))
  const categories = new Map(game.categories.map((c) => [c.id, c.color]))
  const byCode = new Map<string, Binding[]>()
  for (const b of profile.bindings) {
    if (layerOf(b) !== layer) continue
    const list = byCode.get(b.input.code)
    if (list) list.push(b)
    else byCode.set(b.input.code, [b])
  }

  const result = new Map<string, InputPaint>()
  for (const [code, list] of byCode) {
    // Действия на входе в порядке списка действий игры, без повторов
    const own = [...new Set(list.map((b) => b.actionId))]
      .map((id) => actions.get(id))
      .filter((a): a is Action => a !== undefined)
      .sort((a, b) => a.order - b.order)
    const first = own[0]
    const colors =
      colorMode === 'category'
        ? [
            ...new Set(
              own.map((a) =>
                a.categoryId === undefined ? null : (categories.get(a.categoryId) ?? null),
              ),
            ),
          ]
        : []
    result.set(code, {
      colors,
      label: first ? shortLabel(first.name) : undefined,
      title: first?.name,
      extra: Math.max(0, own.length - 1),
      bound: true,
      conflict: list.some((b) => issues.bindingIds.has(b.id)),
    })
  }

  if (colorMode === 'group') {
    for (const group of profile.keyGroups) {
      for (const code of group.inputs) {
        const paint = result.get(code)
        if (paint) paint.colors = [group.color]
        else result.set(code, { colors: [group.color], extra: 0, bound: false, conflict: false })
      }
    }
  }
  return result
}
