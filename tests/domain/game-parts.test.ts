import { describe, expect, it } from 'vitest'
import {
  actionBindingCount,
  actionDraftErrors,
  actionSections,
  addAction,
  matchesAction,
  moveAction,
  removeAction,
  searchSections,
  updateAction,
} from '@/domain/actions'
import {
  addCategory,
  categoryNameError,
  categoryUsage,
  nextColor,
  PALETTE,
  removeCategory,
  reorderCategories,
  updateCategory,
} from '@/domain/categories'
import {
  addContext,
  contextNameError,
  contextUsage,
  globalContext,
  removeContext,
  renameContext,
  reorderContexts,
  sortedContexts,
} from '@/domain/contexts'
import { createGame } from '@/domain/games'
import { moveItem } from '@/domain/order'
import { appDataSchema } from '@/domain/schema'
import type { Game } from '@/domain/types'
import { createAppData } from '@/domain/app-data'
import { at, sampleGame, testClock } from '../fixtures'

const WALK = '22222222-2222-4222-8222-222222222221'
const MOVE = '33333333-3333-4333-8333-333333333331'
const JUMP = '44444444-4444-4444-8444-444444444441'

function valid(game: Game): boolean {
  return appDataSchema.safeParse({ ...createAppData(), games: [game] }).success
}

const names = (game: Game) =>
  actionSections(game).map((s) => [s.category?.name ?? null, s.actions.map((a) => a.name)])

describe('contexts (FR-06)', () => {
  it('adds, renames and keeps the global context first', () => {
    const clock = testClock()
    let game = addContext(sampleGame(), clock, ' В транспорте ')
    game = renameContext(game, WALK, 'Пешком!')
    expect(sortedContexts(game).map((c) => c.name)).toEqual(['Везде', 'Пешком!', 'В транспорте'])
    const transport = at(sortedContexts(game), 2).id
    game = reorderContexts(game, [transport, globalContext(game).id, WALK])
    expect(sortedContexts(game).map((c) => [c.name, c.order])).toEqual([
      ['Везде', 0],
      ['В транспорте', 1],
      ['Пешком!', 2],
    ])
    expect(valid(game)).toBe(true)
  })

  it('names are unique in a game', () => {
    expect(contextNameError(sampleGame(), 'пешком')).toBe('duplicate')
    expect(contextNameError(sampleGame(), 'Пешком', WALK)).toBeNull()
  })

  it('removing moves the actions to another context', () => {
    const game = sampleGame()
    expect(contextUsage(game, WALK)).toBe(1)
    const next = removeContext(game, WALK, globalContext(game).id)
    expect(next.contexts).toHaveLength(1)
    expect(at(next.actions, 0).contextId).toBe(globalContext(game).id)
    expect(valid(next)).toBe(true)
  })

  it('the global context cannot be removed and the target must exist', () => {
    const game = sampleGame()
    expect(() => removeContext(game, globalContext(game).id, WALK)).toThrow()
    expect(() => removeContext(game, WALK, WALK)).toThrow()
    expect(() => removeContext(game, WALK, 'missing')).toThrow()
    expect(removeContext(game, 'missing', WALK)).toBe(game)
  })
})

describe('categories (FR-07)', () => {
  it('adds, updates and reorders', () => {
    const clock = testClock()
    let game = addCategory(sampleGame(), clock, { name: 'Бой', color: '#ef4444' })
    const fight = at(game.categories, 1).id
    expect(at(game.categories, 1).color).toBe('#EF4444')
    game = updateCategory(game, fight, { name: 'Бой!', color: '#10b981' })
    game = reorderCategories(game, [fight, MOVE])
    expect(game.categories.map((c) => `${c.name} ${c.color}`)).toEqual([
      'Бой! #10B981',
      'Движение #3B82F6',
    ])
    expect(categoryNameError(game, 'бой!')).toBe('duplicate')
    expect(valid(game)).toBe(true)
  })

  it('suggests the first unused palette color', () => {
    expect(PALETTE).toHaveLength(12)
    expect(nextColor(sampleGame())).toBe('#EF4444')
    const game = {
      ...sampleGame(),
      categories: PALETTE.map((color, i) => ({ id: `${i}`, name: `${i}`, color })),
    }
    expect(PALETTE).toContain(nextColor(game))
  })

  it('removing takes the category off its actions', () => {
    const game = sampleGame()
    expect(categoryUsage(game, MOVE)).toBe(1)
    const next = removeCategory(game, MOVE)
    expect(next.categories).toEqual([])
    expect(at(next.actions, 0).categoryId).toBeUndefined()
    expect(valid(next)).toBe(true)
  })

  it('removed category actions go after the uncategorized ones', () => {
    const clock = testClock()
    let game = addAction(sampleGame(), clock, { name: 'Меню', contextId: WALK })
    game = addAction(game, clock, { name: 'Бег', contextId: WALK, categoryId: MOVE })
    game = removeCategory(game, MOVE)
    expect(names(game)).toEqual([[null, ['Меню', 'Прыжок', 'Бег']]])
  })
})

describe('actions (FR-08)', () => {
  function threeSections() {
    const clock = testClock()
    let game = addCategory(sampleGame(), clock, { name: 'Бой', color: '#EF4444' })
    const fight = at(game.categories, 1).id
    game = addAction(game, clock, {
      name: 'Бег',
      nameEn: ' Sprint ',
      contextId: WALK,
      categoryId: MOVE,
    })
    game = addAction(game, clock, {
      name: 'Огонь',
      nameEn: 'Fire',
      contextId: WALK,
      categoryId: fight,
    })
    game = addAction(game, clock, { name: 'Карта', nameEn: '', contextId: WALK })
    return { game, fight }
  }

  it('groups actions by category in category order, uncategorized last', () => {
    const { game } = threeSections()
    expect(names(game)).toEqual([
      ['Движение', ['Прыжок', 'Бег']],
      ['Бой', ['Огонь']],
      [null, ['Карта']],
    ])
    const sprint = game.actions.find((a) => a.name === 'Бег')
    expect(sprint?.nameEn).toBe('Sprint')
    expect(game.actions.find((a) => a.name === 'Карта')?.nameEn).toBeUndefined()
    expect(valid(game)).toBe(true)
  })

  it('validates the draft', () => {
    expect(actionDraftErrors({ name: '', contextId: WALK })).toEqual({ name: 'required' })
    expect(
      actionDraftErrors({
        name: 'a'.repeat(81),
        nameEn: 'b'.repeat(81),
        description: 'c'.repeat(301),
        contextId: WALK,
      }),
    ).toEqual({ name: 'tooLong', nameEn: 'tooLong', description: 'tooLong' })
  })

  it('drag inside a section reorders, into another section changes the category', () => {
    const { game, fight } = threeSections()
    const sprint = at(
      game.actions.filter((a) => a.name === 'Бег'),
      0,
    ).id
    let next = moveAction(game, sprint, MOVE, 0)
    expect(names(next)[0]).toEqual(['Движение', ['Бег', 'Прыжок']])
    next = moveAction(next, sprint, fight, 1)
    expect(names(next)).toEqual([
      ['Движение', ['Прыжок']],
      ['Бой', ['Огонь', 'Бег']],
      [null, ['Карта']],
    ])
    expect(next.actions.find((a) => a.id === sprint)?.categoryId).toBe(fight)
    next = moveAction(next, sprint, null, 0)
    expect(names(next)[2]).toEqual([null, ['Бег', 'Карта']])
    expect(next.actions.find((a) => a.id === sprint)?.categoryId).toBeUndefined()
    expect(valid(next)).toBe(true)
    expect(moveAction(game, 'missing', null, 0)).toBe(game)
  })

  it('changing the category in the form moves the action to the end of the section', () => {
    const { game, fight } = threeSections()
    const next = updateAction(game, JUMP, { name: 'Прыжок', contextId: WALK, categoryId: fight })
    expect(names(next)[1]).toEqual(['Бой', ['Огонь', 'Прыжок']])
    const same = updateAction(game, JUMP, {
      name: 'Прыг',
      contextId: WALK,
      categoryId: MOVE,
      description: ' ',
    })
    expect(names(same)[0]).toEqual(['Движение', ['Прыг', 'Бег']])
    expect(same.actions.find((a) => a.id === JUMP)?.description).toBeUndefined()
  })

  it('removing deletes its bindings in every profile', () => {
    const game = sampleGame()
    expect(actionBindingCount(game, JUMP)).toBe(1)
    const next = removeAction(game, JUMP)
    expect(next.actions).toEqual([])
    expect(at(next.profiles, 0).bindings).toEqual([])
    expect(valid(next)).toBe(true)
  })

  it('searches the Russian and English names ignoring case (FR-16)', () => {
    const { game } = threeSections()
    const jump = at(game.actions, 0)
    expect(matchesAction(jump, 'JUMP')).toBe(true)
    expect(matchesAction(jump, 'прыж')).toBe(true)
    expect(matchesAction({ ...jump, name: 'Ёлка' }, 'елк')).toBe(true)
    expect(matchesAction(jump, 'fire')).toBe(false)
    expect(searchSections(game, 'fi').map((s) => s.actions.map((a) => a.name))).toEqual([['Огонь']])
    expect(searchSections(game, ' ')).toHaveLength(3)
  })

  it('a new game has an empty uncategorized section', () => {
    expect(actionSections(createGame(testClock(), 'X'))).toEqual([{ category: null, actions: [] }])
  })
})

describe('moveItem', () => {
  it('moves an element and clamps the target', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b', 'c'], 2, -5)).toEqual(['c', 'a', 'b'])
    expect(moveItem(['a'], 3, 0)).toEqual(['a'])
  })
})
