/**
 * Заготовки Dota 2 и PUBG (FR-22). Файлы грузятся по требованию, чтобы не
 * увеличивать основную сборку (NFR-09). Полный импорт со стратегиями
 * слияния — на этапе 5 (FR-21); здесь игра просто добавляется копией.
 */

import { exportFileSchema } from '@/domain/schema'
import type { Game } from '@/domain/types'

export interface Preset {
  key: string
  game: Game
}

const LOADERS = {
  dota2: () => import('@/presets/dota2.json'),
  pubg: () => import('@/presets/pubg.json'),
}

export async function loadPresets(): Promise<Preset[]> {
  const entries = await Promise.all(
    Object.entries(LOADERS).map(async ([key, load]) => {
      const file = exportFileSchema.parse((await load()).default)
      return file.games.map((game) => ({ key, game }))
    }),
  )
  return entries.flat()
}
