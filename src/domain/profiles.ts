/**
 * Профили игры (FR-11): создать, переименовать, заметки, дублировать,
 * удалить. Последний профиль игры удалить нельзя.
 */

import { ru } from '@/i18n/ru'
import type { Clock } from './clock'
import { LIMITS, nameError, uniqueName, type NameError } from './names'
import type { Game, Profile } from './types'

export function newProfile(clock: Clock, name: string): Profile {
  const now = clock.now()
  return {
    id: clock.id(),
    name: name.trim(),
    notes: '',
    bindings: [],
    settingValues: {},
    keyGroups: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function profileNameError(game: Game, name: string, exceptId?: string): NameError | null {
  const taken = game.profiles.filter((p) => p.id !== exceptId).map((p) => p.name)
  return nameError(name, LIMITS.profile, taken)
}

export function addProfile(game: Game, profile: Profile): Game {
  return { ...game, profiles: [...game.profiles, profile] }
}

function updateProfile(game: Game, id: string, now: string, fn: (p: Profile) => Profile): Game {
  return {
    ...game,
    profiles: game.profiles.map((p) => (p.id === id ? { ...fn(p), updatedAt: now } : p)),
  }
}

export function renameProfile(game: Game, id: string, name: string, now: string): Game {
  return updateProfile(game, id, now, (p) => ({ ...p, name: name.trim() }))
}

export function setProfileNotes(game: Game, id: string, notes: string, now: string): Game {
  return updateProfile(game, id, now, (p) => ({ ...p, notes }))
}

/**
 * Копия профиля: бинды, значения настроек, заметки и группы клавиш с новыми
 * id, название «Копия <имя>» (FR-11, FR-29).
 */
export function duplicateProfile(game: Game, id: string, clock: Clock): Profile {
  const source = game.profiles.find((p) => p.id === id)
  if (!source) throw new Error(`No profile ${id}`)
  const now = clock.now()
  const name = uniqueName(
    ru.defaults.copyOf.replace('{name}', source.name),
    game.profiles.map((p) => p.name),
    LIMITS.profile,
  )
  return {
    id: clock.id(),
    name,
    notes: source.notes,
    bindings: source.bindings.map((b) => ({
      ...b,
      id: clock.id(),
      input: { ...b.input, modifiers: [...b.input.modifiers] },
    })),
    settingValues: { ...source.settingValues },
    keyGroups: source.keyGroups.map((g) => ({ ...g, id: clock.id(), inputs: [...g.inputs] })),
    createdAt: now,
    updatedAt: now,
  }
}

export function canRemoveProfile(game: Game): boolean {
  return game.profiles.length > 1
}

export function removeProfile(game: Game, id: string): Game {
  if (!canRemoveProfile(game)) throw new Error('The last profile of a game cannot be removed')
  return { ...game, profiles: game.profiles.filter((p) => p.id !== id) }
}
