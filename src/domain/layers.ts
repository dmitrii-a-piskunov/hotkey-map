/**
 * Слои модификаторов (FR-14): «Без модификатора», Ctrl, Shift, Alt и
 * сочетания, которые используются в профиле. Модификаторы не делятся на
 * левые и правые.
 */

import { layerKey, layerModifiers } from './bindings'
import type { ProfileIssues } from './conflicts'
import type { Modifier, Profile } from './types'

export const BASE_LAYER = ''
const SINGLE_LAYERS = ['', 'ctrl', 'shift', 'alt']

export interface Layer {
  key: string
  modifiers: Modifier[]
  /** Число биндов в слое */
  count: number
  /** В слое есть бинды с конфликтом или нарушением */
  hasIssues: boolean
}

/** Слой бинда по его модификаторам */
export function layerOf(b: { input: { modifiers: readonly Modifier[] } }): string {
  return layerKey(b.input.modifiers)
}

export function profileLayers(profile: Profile | undefined, issues: ProfileIssues): Layer[] {
  const counts = new Map<string, number>(SINGLE_LAYERS.map((k) => [k, 0]))
  const withIssues = new Set<string>()
  for (const b of profile?.bindings ?? []) {
    const key = layerOf(b)
    counts.set(key, (counts.get(key) ?? 0) + 1)
    if (issues.bindingIds.has(b.id)) withIssues.add(key)
  }
  // Сначала одиночные в фиксированном порядке, затем сочетания по числу модификаторов
  const keys = [...counts.keys()].sort((a, b) => {
    const ma = layerModifiers(a).length
    const mb = layerModifiers(b).length
    if (ma !== mb) return ma - mb
    return SINGLE_LAYERS.indexOf(a) - SINGLE_LAYERS.indexOf(b) || a.localeCompare(b)
  })
  return keys.map((key) => ({
    key,
    modifiers: layerModifiers(key),
    count: counts.get(key) ?? 0,
    hasIssues: withIssues.has(key),
  }))
}

/** Занятые входы слоя — для Ctrl+A в режиме «Навигация» (FR-03) */
export function layerInputs(profile: Profile | undefined, layer: string): string[] {
  const codes = new Set<string>()
  for (const b of profile?.bindings ?? []) if (layerOf(b) === layer) codes.add(b.input.code)
  return [...codes]
}

export interface ActionHighlight {
  /** Слой, в котором видны клавиши действия */
  layer: string
  codes: string[]
}

/**
 * Поиск (FR-16): клавиши действия. Если в текущем слое у действия клавиш
 * нет — слой первого его бинда.
 */
export function actionHighlight(
  profile: Profile | undefined,
  actionId: string,
  currentLayer: string,
): ActionHighlight {
  const own = (profile?.bindings ?? [])
    .filter((b) => b.actionId === actionId)
    .sort((a, b) => a.slot - b.slot)
  const first = own[0]
  const layer =
    own.some((b) => layerOf(b) === currentLayer) || !first ? currentLayer : layerOf(first)
  return { layer, codes: own.filter((b) => layerOf(b) === layer).map((b) => b.input.code) }
}
