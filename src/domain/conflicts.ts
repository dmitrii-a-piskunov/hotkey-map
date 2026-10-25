/**
 * Конфликты и нарушения правил (FR-15). Конфликт — бинды разных действий
 * профиля с одинаковыми клавишей, модификаторами и типом нажатия в
 * пересекающихся контекстах: совпадают или один из них «Везде». Нарушения —
 * бинды, которые стали недопустимыми после смены правил игры. Ни то, ни
 * другое не удаляет бинды: они только подсвечиваются.
 *
 * Пересчёт — один проход по биндам с группировкой по ключу, поэтому
 * укладывается в 50 мс и на 500 биндах (NFR-03).
 */

import { inputKey } from './bindings'
import { DEFAULT_BLOCKED_KEYS } from './schema'
import type { Binding, BindingInput, Game, Modifier, PressType, Profile } from './types'

export interface Conflict {
  /** Ключ входа с модификаторами и типом нажатия */
  key: string
  input: BindingInput
  pressType: PressType
  /** Бинды, которые пересекаются хотя бы с одним другим из этого списка */
  bindings: Binding[]
}

export type Violation =
  | { kind: 'extraSlot'; binding: Binding; max: number }
  | { kind: 'modifierNotAllowed'; binding: Binding; modifiers: Modifier[] }
  | { kind: 'blockedKey'; binding: Binding }

export interface ProfileIssues {
  conflicts: Conflict[]
  violations: Violation[]
  /** id биндов с конфликтом или нарушением */
  bindingIds: ReadonlySet<string>
  /** Число конфликтов и нарушений — счётчик в шапке */
  count: number
}

export const noIssues: ProfileIssues = {
  conflicts: [],
  violations: [],
  bindingIds: new Set(),
  count: 0,
}

/** Контексты пересекаются: совпадают или один из них «Везде» */
export function contextsOverlap(game: Game, a: string, b: string): boolean {
  if (a === b) return true
  const global = game.contexts.find((c) => c.isGlobal)?.id
  return a === global || b === global
}

function contextOf(game: Game, actionIds: Map<string, string>, b: Binding): string {
  return actionIds.get(b.actionId) ?? game.contexts[0]?.id ?? ''
}

/** Пара биндов конфликтует */
function clash(game: Game, contexts: Map<string, string>, a: Binding, b: Binding): boolean {
  return (
    a.actionId !== b.actionId &&
    contextsOverlap(game, contextOf(game, contexts, a), contextOf(game, contexts, b))
  )
}

function conflictKey(b: Binding): string {
  return `${inputKey(b.input)}|${b.pressType}`
}

export function findIssues(game: Game, profile: Profile): ProfileIssues {
  const contexts = new Map(game.actions.map((a) => [a.id, a.contextId]))
  const groups = new Map<string, Binding[]>()
  for (const b of profile.bindings) {
    const key = conflictKey(b)
    const list = groups.get(key)
    if (list) list.push(b)
    else groups.set(key, [b])
  }

  const conflicts: Conflict[] = []
  const bindingIds = new Set<string>()
  for (const [key, list] of groups) {
    if (list.length < 2) continue
    const involved = list.filter((a) => list.some((b) => a !== b && clash(game, contexts, a, b)))
    const first = involved[0]
    if (!first) continue
    involved.forEach((b) => bindingIds.add(b.id))
    conflicts.push({ key, input: first.input, pressType: first.pressType, bindings: involved })
  }

  const { maxKeysPerAction, allowedModifiers, blockedKeys } = game.rules
  const violations: Violation[] = []
  for (const binding of profile.bindings) {
    const code = binding.input.code
    if (DEFAULT_BLOCKED_KEYS.includes(code) || blockedKeys.includes(code)) {
      violations.push({ kind: 'blockedKey', binding })
    }
    if (binding.slot > maxKeysPerAction) {
      violations.push({ kind: 'extraSlot', binding, max: maxKeysPerAction })
    }
    const denied = binding.input.modifiers.filter((m) => !allowedModifiers.includes(m))
    if (denied.length > 0)
      violations.push({ kind: 'modifierNotAllowed', binding, modifiers: denied })
  }
  violations.forEach((v) => bindingIds.add(v.binding.id))

  return { conflicts, violations, bindingIds, count: conflicts.length + violations.length }
}

/** Другие бинды, с которыми конфликтует данный, — список под кнопкой (FR-12, шаг 4) */
export function conflictsWith(game: Game, profile: Profile, bindingId: string): Binding[] {
  const binding = profile.bindings.find((b) => b.id === bindingId)
  if (!binding) return []
  const contexts = new Map(game.actions.map((a) => [a.id, a.contextId]))
  const key = conflictKey(binding)
  return profile.bindings.filter(
    (b) => b.id !== binding.id && conflictKey(b) === key && clash(game, contexts, binding, b),
  )
}

/**
 * Конфликты бинда, который ещё не сохранён (окно привязки, FR-12): вход в
 * слот действия. Прежний бинд этого слота не считается.
 */
export function conflictsForInput(
  game: Game,
  profile: Profile,
  target: { actionId: string; slot: 1 | 2 },
  input: BindingInput,
  pressType: PressType,
): Binding[] {
  const contexts = new Map(game.actions.map((a) => [a.id, a.contextId]))
  const pending: Binding = {
    id: '',
    actionId: target.actionId,
    input,
    pressType,
    slot: target.slot,
  }
  const key = conflictKey(pending)
  return profile.bindings.filter(
    (b) =>
      !(b.actionId === target.actionId && b.slot === target.slot) &&
      conflictKey(b) === key &&
      clash(game, contexts, pending, b),
  )
}

/** Нарушения правил одного бинда */
export function violationsOf(issues: ProfileIssues, bindingId: string): Violation[] {
  return issues.violations.filter((v) => v.binding.id === bindingId)
}
