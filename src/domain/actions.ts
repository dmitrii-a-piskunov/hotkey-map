/**
 * Действия игры (FR-08): список повторяет меню настроек игры — разделы по
 * категориям в их порядке, раздел «Без категории» последним. Порядок
 * действий внутри раздела — поле order; перенос в другой раздел меняет
 * категорию действия. Удаление действия удаляет его бинды во всех профилях.
 */

import type { Clock } from './clock'
import { LIMITS, lengthError, nameError, optionalText, type NameError } from './names'
import { byOrder } from './order'
import type { Action, Category, Game } from './types'

export interface ActionDraft {
  name: string
  nameEn?: string
  contextId: string
  categoryId?: string
  description?: string
  /** Короткая подпись на клавише (FR-26) */
  short?: string
  /** Раскладка меню игры: задаётся в заготовках, правка её сохраняет */
  column?: 1 | 2
  subgroup?: string
}

export interface ActionSection {
  /** null — раздел «Без категории» */
  category: Category | null
  actions: Action[]
}

export interface ActionDraftErrors {
  name?: NameError
  nameEn?: 'tooLong'
  description?: 'tooLong'
  short?: 'tooLong'
}

export function actionDraftErrors(draft: ActionDraft): ActionDraftErrors {
  const errors: ActionDraftErrors = {}
  const name = nameError(draft.name, LIMITS.action)
  if (name) errors.name = name
  if (lengthError(draft.nameEn ?? '', LIMITS.actionEn)) errors.nameEn = 'tooLong'
  if (lengthError(draft.description ?? '', LIMITS.description)) errors.description = 'tooLong'
  if (lengthError(draft.short ?? '', LIMITS.short)) errors.short = 'tooLong'
  return errors
}

/** Разделы по категориям, включая пустые; «Без категории» — всегда последний */
export function actionSections(game: Game): ActionSection[] {
  const known = new Set(game.categories.map((c) => c.id))
  const sorted = byOrder(game.actions)
  return [
    ...game.categories.map((category) => ({
      category,
      actions: sorted.filter((a) => a.categoryId === category.id),
    })),
    {
      category: null,
      actions: sorted.filter((a) => a.categoryId === undefined || !known.has(a.categoryId)),
    },
  ]
}

/** order по сквозной нумерации разделов */
function fromSections(game: Game, sections: readonly ActionSection[]): Game {
  let order = 0
  const actions = sections.flatMap((s) =>
    s.actions.map((a) => {
      const categoryId = s.category?.id
      const next = order++
      return a.order === next && a.categoryId === categoryId ? a : { ...a, order: next, categoryId }
    }),
  )
  return { ...game, actions }
}

function sectionIndex(sections: readonly ActionSection[], categoryId: string | undefined): number {
  const i = sections.findIndex((s) => s.category?.id === categoryId)
  return i === -1 ? sections.length - 1 : i
}

function normalizeDraft(draft: ActionDraft): Omit<Action, 'id' | 'order'> {
  const action: Omit<Action, 'id' | 'order'> = {
    name: draft.name.trim(),
    nameEn: optionalText(draft.nameEn),
    contextId: draft.contextId,
    categoryId: draft.categoryId,
    description: optionalText(draft.description),
  }
  const short = optionalText(draft.short)
  if (short !== undefined) action.short = short
  if (draft.column !== undefined) action.column = draft.column
  if (draft.subgroup !== undefined) action.subgroup = draft.subgroup
  return action
}

/** Новое действие — в конец своего раздела */
export function addAction(game: Game, clock: Clock, draft: ActionDraft): Game {
  const action: Action = { id: clock.id(), ...normalizeDraft(draft), order: 0 }
  const sections = actionSections(game)
  const target = sections[sectionIndex(sections, action.categoryId)]
  target?.actions.push(action)
  return fromSections(game, sections)
}

/** Правка действия; при смене категории оно уходит в конец нового раздела */
export function updateAction(game: Game, id: string, draft: ActionDraft): Game {
  const current = game.actions.find((a) => a.id === id)
  if (!current) return game
  const updated: Action = { ...current, ...normalizeDraft(draft) }
  if (updated.categoryId === current.categoryId) {
    return { ...game, actions: game.actions.map((a) => (a.id === id ? updated : a)) }
  }
  const sections = actionSections({ ...game, actions: game.actions.filter((a) => a.id !== id) })
  sections[sectionIndex(sections, updated.categoryId)]?.actions.push(updated)
  return fromSections(game, sections)
}

/**
 * Перетаскивание: действие встаёт на позицию index раздела categoryId
 * (null — «Без категории») и получает эту категорию.
 */
export function moveAction(game: Game, id: string, categoryId: string | null, index: number): Game {
  const action = game.actions.find((a) => a.id === id)
  if (!action) return game
  const sections = actionSections({ ...game, actions: game.actions.filter((a) => a.id !== id) })
  const target = sections[sectionIndex(sections, categoryId ?? undefined)]
  if (!target) return game
  target.actions.splice(Math.max(0, Math.min(index, target.actions.length)), 0, action)
  return fromSections(game, sections)
}

/** Сколько биндов действия во всех профилях игры */
export function actionBindingCount(game: Game, id: string): number {
  return game.profiles.reduce((n, p) => n + p.bindings.filter((b) => b.actionId === id).length, 0)
}

export function removeAction(game: Game, id: string): Game {
  return fromSections(
    {
      ...game,
      actions: game.actions.filter((a) => a.id !== id),
      profiles: game.profiles.map((p) =>
        p.bindings.some((b) => b.actionId === id)
          ? { ...p, bindings: p.bindings.filter((b) => b.actionId !== id) }
          : p,
      ),
    },
    actionSections({ ...game, actions: game.actions.filter((a) => a.id !== id) }),
  )
}

function searchKey(text: string): string {
  return text.toLocaleLowerCase('ru').replaceAll('ё', 'е').trim()
}

/** FR-16: поиск по русскому и английскому названию без учёта регистра */
export function matchesAction(action: Action, query: string): boolean {
  const q = searchKey(query)
  if (q === '') return true
  return searchKey(action.name).includes(q) || searchKey(action.nameEn ?? '').includes(q)
}

/** Разделы с найденными действиями; при пустом запросе — все разделы */
export function searchSections(game: Game, query: string): ActionSection[] {
  const sections = actionSections(game)
  if (searchKey(query) === '') return sections
  return sections
    .map((s) => ({ ...s, actions: s.actions.filter((a) => matchesAction(a, query)) }))
    .filter((s) => s.actions.length > 0)
}
