/**
 * Контексты игры (FR-06). «Везде» — системный: его нельзя удалить, он
 * всегда первый. Контекст с действиями удаляется только с их переносом.
 */

import type { Clock } from './clock'
import { LIMITS, nameError, type NameError } from './names'
import { byOrder, orderByIds } from './order'
import type { Context, Game } from './types'

export function sortedContexts(game: Game): Context[] {
  const sorted = byOrder(game.contexts)
  return [...sorted.filter((c) => c.isGlobal), ...sorted.filter((c) => !c.isGlobal)]
}

export function globalContext(game: Game): Context {
  const ctx = game.contexts.find((c) => c.isGlobal)
  if (!ctx) throw new Error(`Game ${game.id} has no global context`)
  return ctx
}

export function contextNameError(game: Game, name: string, exceptId?: string): NameError | null {
  const taken = game.contexts.filter((c) => c.id !== exceptId).map((c) => c.name)
  return nameError(name, LIMITS.context, taken)
}

function renumber(contexts: readonly Context[]): Context[] {
  return contexts.map((c, order) => (c.order === order ? c : { ...c, order }))
}

export function addContext(game: Game, clock: Clock, name: string): Game {
  const context: Context = { id: clock.id(), name: name.trim(), isGlobal: false, order: 0 }
  return { ...game, contexts: renumber([...sortedContexts(game), context]) }
}

export function renameContext(game: Game, id: string, name: string): Game {
  return {
    ...game,
    contexts: game.contexts.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)),
  }
}

/** Новый порядок контекстов; «Везде» остаётся первым */
export function reorderContexts(game: Game, ids: readonly string[]): Game {
  const ordered = orderByIds(sortedContexts(game), ids)
  return {
    ...game,
    contexts: renumber([
      ...ordered.filter((c) => c.isGlobal),
      ...ordered.filter((c) => !c.isGlobal),
    ]),
  }
}

/** Сколько действий в контексте */
export function contextUsage(game: Game, id: string): number {
  return game.actions.filter((a) => a.contextId === id).length
}

/** Удаляет контекст, его действия переходят в moveTo */
export function removeContext(game: Game, id: string, moveTo: string): Game {
  const ctx = game.contexts.find((c) => c.id === id)
  if (!ctx) return game
  if (ctx.isGlobal) throw new Error('The global context cannot be removed')
  if (moveTo === id || !game.contexts.some((c) => c.id === moveTo)) {
    throw new Error(`Cannot move actions to context ${moveTo}`)
  }
  return {
    ...game,
    contexts: renumber(sortedContexts(game).filter((c) => c.id !== id)),
    actions: game.actions.map((a) => (a.contextId === id ? { ...a, contextId: moveTo } : a)),
  }
}
