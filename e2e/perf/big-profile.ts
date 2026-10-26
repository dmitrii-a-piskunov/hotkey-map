/**
 * Набор данных NFR-03: заготовка Dota 2, у профиля «Тестовый» 500 биндов.
 * Добавочные действия — в обычных категориях, бинды — по всем слоям
 * модификаторов, без конфликтов: клавиша и модификаторы у каждого бинда свои.
 */

import { readFileSync } from 'node:fs'
import { aulaF75 } from '../../src/layouts/aula-f75.ts'

/** Сколько биндов в профиле (NFR-03) */
export const BIG_BINDINGS = 500

interface Binding {
  id: string
  actionId: string
  input: { device: string; code: string; modifiers: string[] }
  pressType: string
  slot: number
}

interface Preset {
  games: {
    rules: { blockedKeys: string[] }
    contexts: { id: string; name: string }[]
    categories: { id: string; display?: string }[]
    actions: { id: string; name: string; contextId: string; categoryId: string; order: number }[]
    profiles: { name: string; bindings: Binding[] }[]
  }[]
}

/** Порядок слоёв: основной, затем с модификаторами */
const LAYERS = [
  [],
  ['shift'],
  ['alt'],
  ['ctrl'],
  ['ctrl', 'shift'],
  ['ctrl', 'alt'],
  ['shift', 'alt'],
  ['ctrl', 'shift', 'alt'],
]

/** Детерминированный UUID v4 по номеру: z.uuid() проверяет версию и вариант */
function uuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
}

export function bigProfileJson(): string {
  const file = new URL('../../src/presets/dota2.json', import.meta.url)
  const data = JSON.parse(readFileSync(file, 'utf8')) as Preset
  const game = data.games[0]
  const profile = game?.profiles.find((p) => p.name === 'Тестовый')
  const everywhere = game?.contexts.find((c) => c.name === 'Везде')
  if (!game || !profile || !everywhere) throw new Error('dota2.json changed')

  const blocked = new Set(game.rules.blockedKeys)
  const codes = aulaF75.keys.filter((k) => k.assignable && !blocked.has(k.code)).map((k) => k.code)
  const taken = new Set(
    profile.bindings.map((b) => `${b.input.code}|${[...b.input.modifiers].sort().join('+')}`),
  )
  const categories = game.categories.filter((c) => c.display !== 'slots')
  let n = 1
  let order = game.actions.length
  for (const mods of LAYERS) {
    for (const code of codes) {
      if (profile.bindings.length >= BIG_BINDINGS) break
      const key = `${code}|${[...mods].sort().join('+')}`
      if (taken.has(key)) continue
      taken.add(key)
      const category = categories[n % categories.length]
      if (!category) throw new Error('no categories')
      const actionId = uuid(n++)
      game.actions.push({
        id: actionId,
        name: `Действие ${order}`,
        contextId: everywhere.id,
        categoryId: category.id,
        order: order++,
      })
      profile.bindings.push({
        id: uuid(n++),
        actionId,
        input: { device: 'keyboard', code, modifiers: mods },
        pressType: 'press',
        slot: 1,
      })
    }
  }
  if (profile.bindings.length !== BIG_BINDINGS) throw new Error('not enough free keys')
  return JSON.stringify(data)
}
