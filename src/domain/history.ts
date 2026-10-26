/**
 * Отмена и повтор (FR-24): куда перейти после шага истории. Если шаг
 * затронул другую игру или профиль — переходим туда, чтобы было видно, что
 * изменилось. Если текущая игра или профиль пропали — открываем соседний.
 */

import { currentGame, currentProfile } from './current'
import type { AppData, AppSettings, Game, Profile } from './types'

function changedItem<T extends { id: string }>(
  before: readonly T[],
  after: readonly T[],
): T | undefined {
  const old = new Map(before.map((item) => [item.id, item]))
  return after.find((item) => old.get(item.id) !== item)
}

function neighbor<T extends { id: string }>(
  before: readonly T[],
  after: readonly T[],
  id: string,
): T | undefined {
  const index = before.findIndex((item) => item.id === id)
  return after[Math.min(Math.max(index, 0), after.length - 1)]
}

function profileFocus(before: Game | undefined, after: Game, current: Profile | undefined) {
  const changed = before ? changedItem(before.profiles, after.profiles) : undefined
  if (changed) return changed
  if (current && after.profiles.some((p) => p.id === current.id)) return current
  return before && current
    ? neighbor(before.profiles, after.profiles, current.id)
    : after.profiles[0]
}

/** Выбор игры и профиля после отмены или повтора; {} — оставить как есть */
export function focusAfterHistory(before: AppData, after: readonly Game[]): Partial<AppSettings> {
  const game = currentGame(before)
  const profile = game && currentProfile(game, before.appSettings)
  const select = (g: Game | undefined, p: Profile | undefined): Partial<AppSettings> =>
    g ? { lastGameId: g.id, lastProfileId: p?.id ?? g.profiles[0]?.id } : {}

  const changed = changedItem(before.games, after)
  const target =
    changed ??
    (game && !after.some((g) => g.id === game.id)
      ? neighbor(before.games, after, game.id)
      : undefined)
  if (!target) return {}

  const old = before.games.find((g) => g.id === target.id)
  const sameGame = target.id === game?.id
  const focus = profileFocus(old, target, sameGame ? profile : undefined)
  if (sameGame && focus?.id === profile?.id) return {}
  return select(target, focus)
}
