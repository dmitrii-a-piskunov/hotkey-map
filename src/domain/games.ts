/**
 * Игры (FR-05, раздел 9.2): создание с контекстом «Везде» и профилем
 * «Основной», правила, удаление со всеми данными, игра из заготовки.
 */

import { ru } from '@/i18n/ru'
import type { Clock } from './clock'
import { LIMITS, nameError, uniqueName, type NameError } from './names'
import { newProfile } from './profiles'
import { DEFAULT_BLOCKED_KEYS } from './schema'
import type { AppData, Game, GameRules, Modifier } from './types'

export const ALL_MODIFIERS: readonly Modifier[] = ['ctrl', 'shift', 'alt']

export function defaultRules(): GameRules {
  return {
    maxKeysPerAction: 1,
    allowedModifiers: [...ALL_MODIFIERS],
    blockedKeys: [...DEFAULT_BLOCKED_KEYS],
  }
}

export function createGame(clock: Clock, name: string): Game {
  const now = clock.now()
  return {
    id: clock.id(),
    name: name.trim(),
    rules: defaultRules(),
    contexts: [{ id: clock.id(), name: ru.defaults.globalContext, isGlobal: true, order: 0 }],
    categories: [],
    actions: [],
    settingsTemplate: [],
    profiles: [newProfile(clock, ru.defaults.profile)],
    createdAt: now,
    updatedAt: now,
  }
}

export function gameNameError(data: AppData, name: string, exceptId?: string): NameError | null {
  const taken = data.games.filter((g) => g.id !== exceptId).map((g) => g.name)
  return nameError(name, LIMITS.game, taken)
}

/** Новая игра становится текущей вместе со своим первым профилем */
export function addGame(data: AppData, game: Game): AppData {
  const profile = game.profiles[0]
  return {
    ...data,
    games: [...data.games, game],
    appSettings: { ...data.appSettings, lastGameId: game.id, lastProfileId: profile?.id },
  }
}

/** Меняет одну игру; если fn ничего не поменяла, данные остаются прежним объектом */
export function updateGame(
  data: AppData,
  gameId: string,
  fn: (game: Game) => Game,
  now: string,
): AppData {
  const index = data.games.findIndex((g) => g.id === gameId)
  const game = data.games[index]
  if (!game) return data
  const next = fn(game)
  if (next === game) return data
  const games = [...data.games]
  games[index] = { ...next, updatedAt: now }
  return { ...data, games }
}

export interface GameImpact {
  profiles: number
  actions: number
  bindings: number
}

export function gameImpact(game: Game): GameImpact {
  return {
    profiles: game.profiles.length,
    actions: game.actions.length,
    bindings: game.profiles.reduce((n, p) => n + p.bindings.length, 0),
  }
}

/** Удаление игры со всеми данными; если она была текущей — выбирается первая из оставшихся */
export function removeGame(data: AppData, gameId: string): AppData {
  const games = data.games.filter((g) => g.id !== gameId)
  if (games.length === data.games.length) return data
  const settings = data.appSettings
  if (settings.lastGameId !== gameId) return { ...data, games }
  const next = games[0]
  return {
    ...data,
    games,
    appSettings: { ...settings, lastGameId: next?.id, lastProfileId: next?.profiles[0]?.id },
  }
}

export interface GeneralDraft {
  name: string
  steamAppId?: number
  rules: GameRules
}

/** Непередаваемые клавиши: Fn, Win и регулятор — всегда (FR-01) */
export function normalizeBlockedKeys(codes: readonly string[]): string[] {
  return [...new Set([...DEFAULT_BLOCKED_KEYS, ...codes])]
}

/**
 * Название, AppID и правила. Бинды при смене правил не удаляются: лишние
 * клавиши и запрещённые модификаторы станут нарушениями (FR-15, 13.2).
 */
export function setGeneral(game: Game, draft: GeneralDraft): Game {
  return {
    ...game,
    name: draft.name.trim(),
    steamAppId: draft.steamAppId,
    rules: {
      maxKeysPerAction: draft.rules.maxKeysPerAction,
      allowedModifiers: ALL_MODIFIERS.filter((m) => draft.rules.allowedModifiers.includes(m)),
      blockedKeys: normalizeBlockedKeys(draft.rules.blockedKeys),
    },
  }
}

export function setGameIcon(game: Game, icon: string | undefined): Game {
  return game.icon === icon ? game : { ...game, icon }
}

/** Steam AppID из поля ввода: целое положительное или ошибка */
export function parseSteamAppId(text: string): { value?: number; error: boolean } {
  const t = text.trim()
  if (t === '') return { error: false }
  if (!/^\d+$/.test(t)) return { error: true }
  const value = Number(t)
  return value > 0 && Number.isSafeInteger(value) ? { value, error: false } : { error: true }
}

/**
 * Игра из заготовки (FR-22): все id новые, ссылки пересчитаны, при
 * совпадении названия — «Dota 2 (2)». Иконка заготовки не переносится.
 */
export function gameFromPreset(preset: Game, clock: Clock, takenNames: readonly string[]): Game {
  const ids = new Map<string, string>()
  const remap = (id: string): string => {
    let next = ids.get(id)
    if (next === undefined) {
      next = clock.id()
      ids.set(id, next)
    }
    return next
  }
  const remapOptional = (id: string | undefined) => (id === undefined ? undefined : remap(id))
  // Значение настройки-списка — id варианта, его тоже нужно пересчитать
  const selects = new Set(
    preset.settingsTemplate.filter((s) => s.type === 'select').map((s) => s.id),
  )
  const now = clock.now()

  return {
    ...preset,
    id: clock.id(),
    name: uniqueName(preset.name, takenNames, LIMITS.game),
    icon: undefined,
    rules: { ...preset.rules, blockedKeys: normalizeBlockedKeys(preset.rules.blockedKeys) },
    contexts: preset.contexts.map((c) => ({ ...c, id: remap(c.id) })),
    categories: preset.categories.map((c) => ({ ...c, id: remap(c.id) })),
    actions: preset.actions.map((a) => ({
      ...a,
      id: remap(a.id),
      contextId: remap(a.contextId),
      categoryId: remapOptional(a.categoryId),
    })),
    bindParam: preset.bindParam && {
      ...preset.bindParam,
      options: preset.bindParam.options.map((o) => ({ ...o, id: remap(o.id) })),
    },
    settingsTemplate: preset.settingsTemplate.map((s) =>
      s.type === 'select'
        ? {
            ...s,
            id: remap(s.id),
            options: s.options.map((o) => ({ ...o, id: remap(o.id) })),
            defaultValue: remap(s.defaultValue),
          }
        : { ...s, id: remap(s.id) },
    ),
    profiles: preset.profiles.map((p) => ({
      ...p,
      id: clock.id(),
      bindings: p.bindings.map((b) => ({
        ...b,
        id: clock.id(),
        actionId: remap(b.actionId),
        paramOptionId: remapOptional(b.paramOptionId),
      })),
      settingValues: Object.fromEntries(
        Object.entries(p.settingValues).map(([k, v]) => [
          remap(k),
          selects.has(k) && typeof v === 'string' ? remap(v) : v,
        ]),
      ),
      keyGroups: p.keyGroups.map((g) => ({ ...g, id: clock.id() })),
      createdAt: now,
      updatedAt: now,
    })),
    createdAt: now,
    updatedAt: now,
  }
}
