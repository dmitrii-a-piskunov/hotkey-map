/**
 * Текущие игра и профиль (раздел 8.2): по appSettings.lastGameId и
 * lastProfileId, а если их нет или они устарели — первые по списку.
 */

import type { AppData, AppSettings, Game, Profile } from './types'

export function currentGame(data: AppData): Game | undefined {
  const { lastGameId } = data.appSettings
  return data.games.find((g) => g.id === lastGameId) ?? data.games[0]
}

export function currentProfile(game: Game, settings: AppSettings): Profile | undefined {
  return game.profiles.find((p) => p.id === settings.lastProfileId) ?? game.profiles[0]
}

/** Выбор игры: профиль — первый в ней */
export function selectGame(data: AppData, gameId: string): Partial<AppSettings> {
  const game = data.games.find((g) => g.id === gameId)
  if (!game) return {}
  return { lastGameId: game.id, lastProfileId: game.profiles[0]?.id }
}

export function selectProfile(
  data: AppData,
  gameId: string,
  profileId: string,
): Partial<AppSettings> {
  const game = data.games.find((g) => g.id === gameId)
  if (!game?.profiles.some((p) => p.id === profileId)) return {}
  return { lastGameId: gameId, lastProfileId: profileId }
}
