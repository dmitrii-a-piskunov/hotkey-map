import { currentGame, currentProfile } from '@/domain/current'
import type { Game, Profile } from '@/domain/types'
import { useDataStore } from '@/features/data/store'

/** Текущая игра из шапки (раздел 8.2) */
export function useCurrentGame(): Game | undefined {
  return useDataStore((s) => currentGame(s.data))
}

export function useCurrentProfile(): Profile | undefined {
  return useDataStore((s) => {
    const game = currentGame(s.data)
    return game && currentProfile(game, s.data.appSettings)
  })
}

export function useGame(gameId: string | undefined): Game | undefined {
  return useDataStore((s) => s.data.games.find((g) => g.id === gameId))
}
