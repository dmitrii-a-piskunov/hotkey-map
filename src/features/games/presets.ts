/**
 * Заготовки Dota 2 и PUBG (FR-22). Файлы грузятся по требованию, чтобы не
 * увеличивать основную сборку (NFR-09). Это обычные файлы экспорта: они
 * добавляются общим импортом с предпросмотром и стратегиями (FR-21).
 */

import { migrate } from '@/domain/migrations'
import { exportFileSchema } from '@/domain/schema'
import type { ExportFile, Game } from '@/domain/types'

export interface Preset {
  key: string
  file: ExportFile
  game: Game
}

const LOADERS = {
  dota2: () => import('@/presets/dota2.json'),
  pubg: () => import('@/presets/pubg.json'),
}

export async function loadPresets(): Promise<Preset[]> {
  const entries = await Promise.all(
    Object.entries(LOADERS).map(async ([key, load]) => {
      const migrated = migrate((await load()).default)
      if (migrated.kind !== 'ok') throw new Error(`Preset ${key} has a wrong version`)
      const file = exportFileSchema.parse(migrated.data)
      return file.games.map((game) => ({ key, file, game }))
    }),
  )
  return entries.flat()
}
