/**
 * Производные данные текущего профиля для интерфейса: конфликты и
 * нарушения (FR-15), слои (FR-14). Считаются один раз на версию профиля.
 */

import { findIssues, noIssues, type ProfileIssues } from '@/domain/conflicts'
import { currentGame, currentProfile } from '@/domain/current'
import { profileLayers, type Layer } from '@/domain/layers'
import type { AppData, Game, Profile } from '@/domain/types'
import { useDataStore } from '@/features/data/store'

const issuesCache = new WeakMap<Profile, { game: Game; issues: ProfileIssues }>()

/** Конфликты профиля; тот же объект, пока не меняются игра и профиль */
export function issuesOf(game: Game, profile: Profile): ProfileIssues {
  const cached = issuesCache.get(profile)
  if (cached?.game === game) return cached.issues
  const issues = findIssues(game, profile)
  issuesCache.set(profile, { game, issues })
  return issues
}

export function currentIssues(data: AppData): ProfileIssues {
  const game = currentGame(data)
  const profile = game && currentProfile(game, data.appSettings)
  return game && profile ? issuesOf(game, profile) : noIssues
}

export function useCurrentIssues(): ProfileIssues {
  return useDataStore((s) => currentIssues(s.data))
}

const layersCache = new WeakMap<ProfileIssues, Layer[]>()
const emptyLayers = profileLayers(undefined, noIssues)

/** Слои текущего профиля с числом биндов (FR-14) */
export function useCurrentLayers(): Layer[] {
  return useDataStore((s) => {
    const game = currentGame(s.data)
    const profile = game && currentProfile(game, s.data.appSettings)
    if (!game || !profile) return emptyLayers
    const issues = issuesOf(game, profile)
    let layers = layersCache.get(issues)
    if (!layers) {
      layers = profileLayers(profile, issues)
      layersCache.set(issues, layers)
    }
    return layers
  })
}
