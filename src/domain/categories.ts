/**
 * Категории действий с цветом (FR-07). Порядок категорий — порядок
 * разделов списка действий (FR-08), он же порядок в массиве.
 */

import type { Clock } from './clock'
import { LIMITS, nameError, type NameError } from './names'
import { orderByIds } from './order'
import type { Category, Game } from './types'

/** Палитра категорий и групп клавиш: 12 цветов, различимых в обеих темах (раздел 9.5) */
export const PALETTE = [
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#EAB308',
  '#84CC16',
  '#10B981',
  '#14B8A6',
  '#06B6D4',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#64748B',
] as const

export function isHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value)
}

/** Первый цвет палитры, которого ещё нет у категорий */
export function nextColor(game: Game): string {
  const used = new Set(game.categories.map((c) => c.color.toUpperCase()))
  return (
    PALETTE.find((c) => !used.has(c)) ??
    PALETTE[game.categories.length % PALETTE.length] ??
    PALETTE[0]
  )
}

export function categoryNameError(game: Game, name: string, exceptId?: string): NameError | null {
  const taken = game.categories.filter((c) => c.id !== exceptId).map((c) => c.name)
  return nameError(name, LIMITS.category, taken)
}

export interface CategoryDraft {
  name: string
  color: string
}

export function addCategory(game: Game, clock: Clock, draft: CategoryDraft): Game {
  const category: Category = {
    id: clock.id(),
    name: draft.name.trim(),
    color: draft.color.toUpperCase(),
  }
  return { ...game, categories: [...game.categories, category] }
}

export function updateCategory(game: Game, id: string, draft: CategoryDraft): Game {
  return {
    ...game,
    categories: game.categories.map((c) =>
      c.id === id ? { ...c, name: draft.name.trim(), color: draft.color.toUpperCase() } : c,
    ),
  }
}

export function reorderCategories(game: Game, ids: readonly string[]): Game {
  return { ...game, categories: orderByIds(game.categories, ids) }
}

/** Сколько действий в категории */
export function categoryUsage(game: Game, id: string): number {
  return game.actions.filter((a) => a.categoryId === id).length
}

/**
 * Удаляет категорию и снимает её с действий: они переходят в раздел «Без
 * категории», после его действий, в прежнем порядке.
 */
export function removeCategory(game: Game, id: string): Game {
  const base = game.actions.reduce((max, a) => Math.max(max, a.order), -1) + 1
  return {
    ...game,
    categories: game.categories.filter((c) => c.id !== id),
    actions: game.actions.map((a) =>
      a.categoryId === id ? { ...a, categoryId: undefined, order: base + a.order } : a,
    ),
  }
}
