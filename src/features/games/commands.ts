/**
 * Команды редактора игры и профилей. Каждая — вызов чистой функции из
 * src/domain через useDataStore.apply: одно место для автосохранения
 * сейчас и отмены изменений на этапе 5. Выбор игры и профиля — настройка
 * приложения (lastGameId, lastProfileId), он идёт через updateSettings.
 */

import {
  addAction,
  moveAction,
  removeAction,
  updateAction,
  type ActionDraft,
} from '@/domain/actions'
import { removeBindParam, setBindParam, type BindParamDraft } from '@/domain/bind-param'
import {
  addCategory,
  removeCategory,
  reorderCategories,
  updateCategory,
  type CategoryDraft,
} from '@/domain/categories'
import { systemClock } from '@/domain/clock'
import { addContext, removeContext, renameContext, reorderContexts } from '@/domain/contexts'
import { selectGame, selectProfile } from '@/domain/current'
import {
  addGame,
  createGame,
  gameFromPreset,
  fillSteamAppId,
  removeGame,
  setGameIcon,
  setGeneral,
  updateGame,
  type GeneralDraft,
} from '@/domain/games'
import {
  addProfile,
  duplicateProfile,
  newProfile,
  removeProfile,
  renameProfile,
  setProfileNotes,
} from '@/domain/profiles'
import {
  addSetting,
  moveSetting,
  removeSetting,
  updateSetting,
  type SettingDraft,
} from '@/domain/settings-template'
import type { Game } from '@/domain/types'
import { useDataStore } from '@/features/data/store'

const clock = systemClock

function data() {
  return useDataStore.getState().data
}

function onGame(gameId: string, fn: (game: Game) => Game): void {
  useDataStore.getState().apply((d) => updateGame(d, gameId, fn, clock.now()))
}

// Игры (FR-05)

/** Новая игра с контекстом «Везде» и профилем «Основной»; становится текущей */
export function createGameCmd(name: string): string {
  const game = createGame(clock, name)
  useDataStore.getState().apply((d) => addGame(d, game))
  return game.id
}

export function addPresetGameCmd(preset: Game): string {
  const game = gameFromPreset(
    preset,
    clock,
    data().games.map((g) => g.name),
  )
  useDataStore.getState().apply((d) => addGame(d, game))
  return game.id
}

export function removeGameCmd(gameId: string): void {
  useDataStore.getState().apply((d) => removeGame(d, gameId))
}

export function setGeneralCmd(gameId: string, draft: GeneralDraft): void {
  onGame(gameId, (g) => setGeneral(g, draft))
}

export function setGameIconCmd(gameId: string, icon: string | undefined): void {
  onGame(gameId, (g) => setGameIcon(g, icon))
}

export function fillSteamAppIdCmd(gameId: string, appId: number): void {
  onGame(gameId, (g) => fillSteamAppId(g, appId))
}

export function selectGameCmd(gameId: string): void {
  useDataStore.getState().updateSettings(selectGame(data(), gameId))
}

// Контексты (FR-06)

export function addContextCmd(gameId: string, name: string): void {
  onGame(gameId, (g) => addContext(g, clock, name))
}

export function renameContextCmd(gameId: string, id: string, name: string): void {
  onGame(gameId, (g) => renameContext(g, id, name))
}

export function reorderContextsCmd(gameId: string, ids: readonly string[]): void {
  onGame(gameId, (g) => reorderContexts(g, ids))
}

export function removeContextCmd(gameId: string, id: string, moveTo: string): void {
  onGame(gameId, (g) => removeContext(g, id, moveTo))
}

// Категории (FR-07)

export function addCategoryCmd(gameId: string, draft: CategoryDraft): void {
  onGame(gameId, (g) => addCategory(g, clock, draft))
}

export function updateCategoryCmd(gameId: string, id: string, draft: CategoryDraft): void {
  onGame(gameId, (g) => updateCategory(g, id, draft))
}

export function reorderCategoriesCmd(gameId: string, ids: readonly string[]): void {
  onGame(gameId, (g) => reorderCategories(g, ids))
}

export function removeCategoryCmd(gameId: string, id: string): void {
  onGame(gameId, (g) => removeCategory(g, id))
}

// Действия (FR-08)

export function addActionCmd(gameId: string, draft: ActionDraft): void {
  onGame(gameId, (g) => addAction(g, clock, draft))
}

export function updateActionCmd(gameId: string, id: string, draft: ActionDraft): void {
  onGame(gameId, (g) => updateAction(g, id, draft))
}

export function moveActionCmd(
  gameId: string,
  id: string,
  categoryId: string | null,
  index: number,
): void {
  onGame(gameId, (g) => moveAction(g, id, categoryId, index))
}

export function removeActionCmd(gameId: string, id: string): void {
  onGame(gameId, (g) => removeAction(g, id))
}

// Параметр бинда (FR-09)

export function setBindParamCmd(gameId: string, draft: BindParamDraft): void {
  onGame(gameId, (g) => setBindParam(g, clock, draft))
}

export function removeBindParamCmd(gameId: string): void {
  onGame(gameId, removeBindParam)
}

// Шаблон настроек (FR-10)

export function addSettingCmd(gameId: string, draft: SettingDraft): void {
  onGame(gameId, (g) => addSetting(g, clock, draft))
}

export function updateSettingCmd(gameId: string, id: string, draft: SettingDraft): void {
  onGame(gameId, (g) => updateSetting(g, id, draft))
}

export function moveSettingCmd(gameId: string, id: string, group: string, index: number): void {
  onGame(gameId, (g) => moveSetting(g, id, group, index))
}

export function removeSettingCmd(gameId: string, id: string): void {
  onGame(gameId, (g) => removeSetting(g, id))
}

// Профили (FR-11)

export function selectProfileCmd(gameId: string, profileId: string): void {
  useDataStore.getState().updateSettings(selectProfile(data(), gameId, profileId))
}

/** Новый профиль становится текущим */
export function createProfileCmd(gameId: string, name: string): void {
  const profile = newProfile(clock, name)
  onGame(gameId, (g) => addProfile(g, profile))
  selectProfileCmd(gameId, profile.id)
}

export function updateProfileCmd(gameId: string, id: string, name: string, notes: string): void {
  const now = clock.now()
  onGame(gameId, (g) => {
    const profile = g.profiles.find((p) => p.id === id)
    if (!profile || (profile.name === name.trim() && profile.notes === notes)) return g
    return setProfileNotes(renameProfile(g, id, name, now), id, notes, now)
  })
}

/** «Копия <имя>» становится текущим профилем */
export function duplicateProfileCmd(gameId: string, id: string): void {
  const game = data().games.find((g) => g.id === gameId)
  if (!game) return
  const copy = duplicateProfile(game, id, clock)
  onGame(gameId, (g) => addProfile(g, copy))
  selectProfileCmd(gameId, copy.id)
}

export function removeProfileCmd(gameId: string, id: string): void {
  onGame(gameId, (g) => removeProfile(g, id))
  const settings = data().appSettings
  if (settings.lastProfileId === id) {
    const game = data().games.find((g) => g.id === gameId)
    const first = game?.profiles[0]
    if (first) selectProfileCmd(gameId, first.id)
  }
}
