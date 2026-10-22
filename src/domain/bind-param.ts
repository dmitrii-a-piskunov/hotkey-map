/**
 * Параметр бинда (FR-09): один необязательный на игру, название и список
 * значений. Удалённый вариант снимается с биндов всех профилей.
 */

import type { Clock } from './clock'
import { LIMITS, nameError, type NameError } from './names'
import type { Game } from './types'

export interface BindParamDraft {
  name: string
  /** id — у существующих вариантов, у новых его нет */
  options: { id?: string; name: string }[]
}

export interface BindParamErrors {
  name?: NameError
  /** Ошибки по индексу варианта */
  options: (NameError | null)[]
  noOptions?: true
}

export function bindParamErrors(draft: BindParamDraft): BindParamErrors {
  const errors: BindParamErrors = { options: [] }
  const name = nameError(draft.name, LIMITS.bindParam)
  if (name) errors.name = name
  if (draft.options.length === 0) errors.noOptions = true
  errors.options = draft.options.map((o, i) =>
    nameError(
      o.name,
      LIMITS.option,
      draft.options.slice(0, i).map((x) => x.name),
    ),
  )
  return errors
}

export function hasBindParamErrors(errors: BindParamErrors): boolean {
  return (
    errors.name !== undefined || errors.noOptions === true || errors.options.some((e) => e !== null)
  )
}

/** Бинды, у которых пропадёт значение параметра; keep = null — параметр удаляется целиком */
export function bindParamImpact(game: Game, keep: ReadonlySet<string> | null): number {
  return game.profiles.reduce(
    (n, p) =>
      n +
      p.bindings.filter((b) => b.paramOptionId !== undefined && !keep?.has(b.paramOptionId)).length,
    0,
  )
}

function stripOptions(game: Game, keep: ReadonlySet<string> | null): Game['profiles'] {
  return game.profiles.map((p) => {
    const lost = (id: string | undefined) => id !== undefined && !keep?.has(id)
    if (!p.bindings.some((b) => lost(b.paramOptionId))) return p
    return {
      ...p,
      bindings: p.bindings.map((b) =>
        lost(b.paramOptionId) ? { ...b, paramOptionId: undefined } : b,
      ),
    }
  })
}

/** id вариантов, которые останутся после сохранения черновика */
export function keptOptionIds(draft: BindParamDraft): Set<string> {
  return new Set(draft.options.flatMap((o) => (o.id === undefined ? [] : [o.id])))
}

export function setBindParam(game: Game, clock: Clock, draft: BindParamDraft): Game {
  const keep = keptOptionIds(draft)
  return {
    ...game,
    bindParam: {
      name: draft.name.trim(),
      options: draft.options.map((o) => ({ id: o.id ?? clock.id(), name: o.name.trim() })),
    },
    profiles: stripOptions(game, keep),
  }
}

export function removeBindParam(game: Game): Game {
  if (!game.bindParam) return game
  return { ...game, bindParam: undefined, profiles: stripOptions(game, null) }
}
