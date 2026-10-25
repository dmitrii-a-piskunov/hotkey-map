/**
 * Бинды профиля (FR-12, FR-14): вход с модификаторами, слоты действия,
 * тип нажатия и параметр. Модификаторы хранятся в одном порядке — Ctrl,
 * Shift, Alt, — поэтому одинаковые комбинации сравниваются как строки.
 */

import type { Clock } from './clock'
import { updateProfile } from './profiles'
import { DEFAULT_BLOCKED_KEYS, MOUSE_CODES } from './schema'
import type { Binding, BindingInput, Game, Modifier, PressType, Profile } from './types'

export const MODIFIER_ORDER: readonly Modifier[] = ['ctrl', 'shift', 'alt']
export const DEFAULT_PRESS_TYPE: PressType = 'press'
export const PRESS_TYPES: readonly PressType[] = ['press', 'hold', 'toggle', 'double', 'long']

/** Модификаторы без повторов в порядке Ctrl, Shift, Alt */
export function normalizeModifiers(mods: readonly Modifier[]): Modifier[] {
  return MODIFIER_ORDER.filter((m) => mods.includes(m))
}

/** Ключ слоя (FR-14): '' — без модификатора, 'ctrl', 'ctrl+shift' */
export function layerKey(mods: readonly Modifier[]): string {
  return normalizeModifiers(mods).join('+')
}

export function layerModifiers(key: string): Modifier[] {
  return key === '' ? [] : normalizeModifiers(key.split('+') as Modifier[])
}

/** Ключ входа с модификаторами: одинаковые комбинации дают одинаковый ключ */
export function inputKey(input: BindingInput): string {
  return `${layerKey(input.modifiers)}|${input.code}`
}

const MOUSE = new Set<string>(MOUSE_CODES)

/** Модификатор, который даёт сама клавиша: Ctrl+Ctrl не бывает */
const OWN_MODIFIER: Record<string, Modifier> = {
  ControlLeft: 'ctrl',
  ControlRight: 'ctrl',
  ShiftLeft: 'shift',
  ShiftRight: 'shift',
  AltLeft: 'alt',
  AltRight: 'alt',
}

export function ownModifier(code: string): Modifier | undefined {
  return OWN_MODIFIER[code]
}

/** Вход бинда по коду: мышь или клавиатура, модификаторы без своего */
export function makeInput(code: string, modifiers: readonly Modifier[]): BindingInput {
  const own = ownModifier(code)
  const mods = normalizeModifiers(modifiers.filter((m) => m !== own))
  if (MOUSE.has(code)) {
    return { device: 'mouse', code: code as (typeof MOUSE_CODES)[number], modifiers: mods }
  }
  return { device: 'keyboard', code, modifiers: mods }
}

export function sameInput(a: BindingInput, b: BindingInput): boolean {
  return inputKey(a) === inputKey(b)
}

export type CaptureError =
  { kind: 'blockedKey' } | { kind: 'modifierNotAllowed'; modifiers: Modifier[] }

/**
 * Правила игры при назначении (FR-12, шаг 3): непередаваемые клавиши и
 * недопустимые модификаторы. Бинд с такой ошибкой не сохраняется.
 */
export function captureError(game: Game, input: BindingInput): CaptureError | null {
  if (DEFAULT_BLOCKED_KEYS.includes(input.code) || game.rules.blockedKeys.includes(input.code)) {
    return { kind: 'blockedKey' }
  }
  const denied = input.modifiers.filter((m) => !game.rules.allowedModifiers.includes(m))
  if (denied.length > 0) return { kind: 'modifierNotAllowed', modifiers: denied }
  return null
}

export function bindingsOfAction(profile: Profile, actionId: string): Binding[] {
  return profile.bindings.filter((b) => b.actionId === actionId).sort((a, b) => a.slot - b.slot)
}

export function bindingInSlot(
  profile: Profile,
  actionId: string,
  slot: number,
): Binding | undefined {
  return profile.bindings.find((b) => b.actionId === actionId && b.slot === slot)
}

/** Первый свободный слот действия по правилу игры; null — все заняты (TC-02) */
export function freeSlot(game: Game, profile: Profile, actionId: string): 1 | 2 | null {
  const slots: (1 | 2)[] = game.rules.maxKeysPerAction === 2 ? [1, 2] : [1]
  return slots.find((s) => !bindingInSlot(profile, actionId, s)) ?? null
}

export interface AssignTarget {
  profileId: string
  actionId: string
  slot: 1 | 2
}

/**
 * Назначение входа в слот действия. Тип нажатия и параметр прежнего бинда
 * слота сохраняются. Тот же вход в другом слоте этого действия снимается:
 * дважды одну клавишу действию не назначают.
 */
export function assignBinding(
  game: Game,
  target: AssignTarget,
  input: BindingInput,
  clock: Clock,
): Game {
  return updateProfile(game, target.profileId, clock.now(), (p) => {
    const current = bindingInSlot(p, target.actionId, target.slot)
    if (current && sameInput(current.input, input)) return p
    const binding: Binding = current
      ? { ...current, input }
      : {
          id: clock.id(),
          actionId: target.actionId,
          input,
          pressType: DEFAULT_PRESS_TYPE,
          slot: target.slot,
        }
    const rest = p.bindings.filter(
      (b) => b.id !== current?.id && !(b.actionId === target.actionId && sameInput(b.input, input)),
    )
    return { ...p, bindings: [...rest, binding] }
  })
}

export function removeBindings(
  game: Game,
  profileId: string,
  ids: readonly string[],
  now: string,
): Game {
  return updateProfile(game, profileId, now, (p) =>
    p.bindings.some((b) => ids.includes(b.id))
      ? { ...p, bindings: p.bindings.filter((b) => !ids.includes(b.id)) }
      : p,
  )
}

function updateBinding(
  game: Game,
  profileId: string,
  bindingId: string,
  now: string,
  fn: (b: Binding) => Binding,
): Game {
  return updateProfile(game, profileId, now, (p) => {
    const index = p.bindings.findIndex((b) => b.id === bindingId)
    const current = p.bindings[index]
    if (!current) return p
    const next = fn(current)
    if (next === current) return p
    const bindings = [...p.bindings]
    bindings[index] = next
    return { ...p, bindings }
  })
}

export function setPressType(
  game: Game,
  profileId: string,
  bindingId: string,
  pressType: PressType,
  now: string,
): Game {
  return updateBinding(game, profileId, bindingId, now, (b) =>
    b.pressType === pressType ? b : { ...b, pressType },
  )
}

/** Параметр бинда (FR-09); undefined — значение по умолчанию */
export function setBindingParam(
  game: Game,
  profileId: string,
  bindingId: string,
  optionId: string | undefined,
  now: string,
): Game {
  return updateBinding(game, profileId, bindingId, now, (b) => {
    if (b.paramOptionId === optionId) return b
    const next = { ...b, paramOptionId: optionId }
    if (optionId === undefined) delete next.paramOptionId
    return next
  })
}

/** Значение параметра по умолчанию — первый вариант (FR-09) */
export function defaultParamOptionId(game: Game): string | undefined {
  return game.bindParam?.options[0]?.id
}

/** Параметр отличается от значения по умолчанию — показываем его в строке (FR-12) */
export function hasCustomParam(game: Game, binding: Binding): boolean {
  return binding.paramOptionId !== undefined && binding.paramOptionId !== defaultParamOptionId(game)
}

/**
 * Режим каста для группы действий (ячейки «Способности и предметы», как в
 * Dota 2): вариант ставится всем их биндам; первый вариант не хранится.
 */
export function setParamForActions(
  game: Game,
  profileId: string,
  actionIds: readonly string[],
  optionId: string | undefined,
  now: string,
): Game {
  const value = optionId === defaultParamOptionId(game) ? undefined : optionId
  return updateProfile(game, profileId, now, (p) => {
    const touched = (b: Binding) => actionIds.includes(b.actionId) && b.paramOptionId !== value
    if (!p.bindings.some(touched)) return p
    const bindings = p.bindings.map((b) => {
      if (!touched(b)) return b
      const next = { ...b, paramOptionId: value }
      if (value === undefined) delete next.paramOptionId
      return next
    })
    return { ...p, bindings }
  })
}

/**
 * Общий режим каста биндов группы: вариант, если он у всех одинаковый;
 * null — разные или биндов нет
 */
export function commonParam(
  game: Game,
  profile: Profile,
  actionIds: readonly string[],
): string | null {
  const values = new Set(
    profile.bindings
      .filter((b) => actionIds.includes(b.actionId))
      .map((b) => b.paramOptionId ?? defaultParamOptionId(game)),
  )
  const [only] = values
  return values.size === 1 && only !== undefined ? only : null
}

/** Бинды на физическом входе: все слои, текущий — первым */
export function bindingsOnInput(profile: Profile, code: string, layer: string): Binding[] {
  const own = profile.bindings.filter((b) => b.input.code === code)
  return [
    ...own.filter((b) => layerKey(b.input.modifiers) === layer),
    ...own.filter((b) => layerKey(b.input.modifiers) !== layer),
  ]
}
