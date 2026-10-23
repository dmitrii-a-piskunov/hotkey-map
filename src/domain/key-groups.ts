/**
 * Группы клавиш профиля (FR-29): название и цвет. Вход — не больше чем в
 * одной группе профиля: добавление в группу забирает его из другой. Fn и
 * регулятор в группы не входят — на них ничего не бывает.
 */

import type { Clock } from './clock'
import { LIMITS, nameError, uniqueName, type NameError } from './names'
import { updateProfile } from './profiles'
import { DEFAULT_BLOCKED_KEYS } from './schema'
import type { Game, KeyGroup, Profile } from './types'

export interface KeyGroupDraft {
  name: string
  color: string
}

export function keyGroupNameError(name: string): NameError | null {
  return nameError(name, LIMITS.keyGroup)
}

/** Входы, которые можно положить в группу */
export function groupableInputs(codes: readonly string[]): string[] {
  return [...new Set(codes)].filter((c) => !DEFAULT_BLOCKED_KEYS.includes(c))
}

export function groupOf(profile: Profile, code: string): KeyGroup | undefined {
  return profile.keyGroups.find((g) => g.inputs.includes(code))
}

/** Входы из codes, которые уже в других группах — о них спрашиваем перед переносом */
export function inputsInOtherGroups(
  profile: Profile,
  codes: readonly string[],
  exceptGroupId?: string,
): { code: string; group: KeyGroup }[] {
  return groupableInputs(codes).flatMap((code) => {
    const group = groupOf(profile, code)
    return group && group.id !== exceptGroupId ? [{ code, group }] : []
  })
}

/** Убирает входы из всех групп, кроме keepId */
function takeFromGroups(groups: KeyGroup[], codes: readonly string[], keepId: string): KeyGroup[] {
  return groups.map((g) =>
    g.id !== keepId && g.inputs.some((c) => codes.includes(c))
      ? { ...g, inputs: g.inputs.filter((c) => !codes.includes(c)) }
      : g,
  )
}

export function createKeyGroup(
  game: Game,
  profileId: string,
  draft: KeyGroupDraft,
  codes: readonly string[],
  clock: Clock,
): { game: Game; groupId: string } {
  const inputs = groupableInputs(codes)
  const group: KeyGroup = { id: clock.id(), name: draft.name.trim(), color: draft.color, inputs }
  const next = updateProfile(game, profileId, clock.now(), (p) => ({
    ...p,
    keyGroups: [...takeFromGroups(p.keyGroups, inputs, group.id), group],
  }))
  return { game: next, groupId: group.id }
}

function updateGroups(
  game: Game,
  profileId: string,
  now: string,
  fn: (groups: KeyGroup[]) => KeyGroup[],
): Game {
  return updateProfile(game, profileId, now, (p) => {
    const keyGroups = fn(p.keyGroups)
    return keyGroups === p.keyGroups ? p : { ...p, keyGroups }
  })
}

export function updateKeyGroup(
  game: Game,
  profileId: string,
  groupId: string,
  draft: KeyGroupDraft,
  now: string,
): Game {
  return updateGroups(game, profileId, now, (groups) =>
    groups.map((g) =>
      g.id === groupId ? { ...g, name: draft.name.trim(), color: draft.color } : g,
    ),
  )
}

/** Добавить входы в группу, забрав их из других групп */
export function addToKeyGroup(
  game: Game,
  profileId: string,
  groupId: string,
  codes: readonly string[],
  now: string,
): Game {
  const inputs = groupableInputs(codes)
  return updateGroups(game, profileId, now, (groups) => {
    const target = groups.find((g) => g.id === groupId)
    if (!target || inputs.every((c) => target.inputs.includes(c))) return groups
    return takeFromGroups(groups, inputs, groupId).map((g) =>
      g.id === groupId ? { ...g, inputs: [...new Set([...g.inputs, ...inputs])] } : g,
    )
  })
}

export function removeFromKeyGroup(
  game: Game,
  profileId: string,
  groupId: string,
  codes: readonly string[],
  now: string,
): Game {
  return updateGroups(game, profileId, now, (groups) => {
    const target = groups.find((g) => g.id === groupId)
    if (!target?.inputs.some((c) => codes.includes(c))) return groups
    return groups.map((g) =>
      g.id === groupId ? { ...g, inputs: g.inputs.filter((c) => !codes.includes(c)) } : g,
    )
  })
}

export function removeKeyGroup(game: Game, profileId: string, groupId: string, now: string): Game {
  return updateGroups(game, profileId, now, (groups) =>
    groups.some((g) => g.id === groupId) ? groups.filter((g) => g.id !== groupId) : groups,
  )
}

/** Входы копируемой группы, занятые группами целевого профиля */
export function copyConflicts(
  game: Game,
  fromProfileId: string,
  groupId: string,
  toProfileId: string,
): { code: string; group: KeyGroup }[] {
  const source = game.profiles.find((p) => p.id === fromProfileId)
  const target = game.profiles.find((p) => p.id === toProfileId)
  const group = source?.keyGroups.find((g) => g.id === groupId)
  if (!group || !target) return []
  return inputsInOtherGroups(target, group.inputs)
}

/**
 * Копия группы в другой профиль игры (FR-29). Входы, которые там уже в
 * группах, переносятся в копию; занятое название получает номер.
 */
export function copyKeyGroup(
  game: Game,
  fromProfileId: string,
  groupId: string,
  toProfileId: string,
  clock: Clock,
): Game {
  const source = game.profiles.find((p) => p.id === fromProfileId)
  const target = game.profiles.find((p) => p.id === toProfileId)
  const group = source?.keyGroups.find((g) => g.id === groupId)
  if (!group || !target || fromProfileId === toProfileId) return game
  const name = uniqueName(
    group.name,
    target.keyGroups.map((g) => g.name),
    LIMITS.keyGroup,
  )
  return createKeyGroup(game, toProfileId, { name, color: group.color }, group.inputs, clock).game
}
