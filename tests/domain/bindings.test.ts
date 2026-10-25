import { describe, expect, it } from 'vitest'
import {
  assignBinding,
  bindingInSlot,
  bindingsOnInput,
  captureError,
  freeSlot,
  hasCustomParam,
  inputKey,
  layerKey,
  makeInput,
  removeBindings,
  setBindingParam,
  setPressType,
} from '@/domain/bindings'
import { conflictsWith, contextsOverlap, findIssues } from '@/domain/conflicts'
import { paintInputs } from '@/domain/key-paint'
import { actionHighlight, layerInputs, profileLayers } from '@/domain/layers'
import type { Action, Binding, Game, Profile } from '@/domain/types'
import { at, sampleGame, testClock } from '../fixtures'

const LATER = '2026-10-23T10:00:00.000Z'
const GLOBAL = '22222222-2222-4222-8222-222222222220'
const ON_FOOT = '22222222-2222-4222-8222-222222222221'
const VEHICLE = '22222222-2222-4222-8222-222222222222'
const MOVE = '33333333-3333-4333-8333-333333333331'
const COMBAT = '33333333-3333-4333-8333-333333333332'
const MAIN = '66666666-6666-4666-8666-666666666661'
const JUMP = '44444444-4444-4444-8444-444444444441'
const USE = '44444444-4444-4444-8444-444444444442'
const HORN = '44444444-4444-4444-8444-444444444443'
const ENTER = '44444444-4444-4444-8444-444444444444'

function action(id: string, name: string, contextId: string, order: number, categoryId?: string) {
  const a: Action = { id, name, contextId, order }
  if (categoryId) a.categoryId = categoryId
  return a
}

/** PUBG из фикстуры: Пешком, В транспорте, две категории и четыре действия */
function game(): Game {
  const g = sampleGame()
  return {
    ...g,
    contexts: [...g.contexts, { id: VEHICLE, name: 'В транспорте', isGlobal: false, order: 2 }],
    categories: [...g.categories, { id: COMBAT, name: 'Бой', color: '#EF4444' }],
    actions: [
      action(JUMP, 'Прыжок', ON_FOOT, 0, MOVE),
      action(USE, 'Взаимодействие', GLOBAL, 1, COMBAT),
      action(HORN, 'Сигнал', VEHICLE, 2),
      action(ENTER, 'Сесть в транспорт', ON_FOOT, 3, MOVE),
    ],
  }
}

function profile(g: Game): Profile {
  return at(g.profiles, 0)
}

/** Один источник id на весь файл: у биндов из разных вызовов разные id */
const clock = testClock(LATER)

function assign(
  g: Game,
  actionId: string,
  code: string,
  slot: 1 | 2 = 1,
  mods: Binding['input']['modifiers'] = [],
) {
  return assignBinding(g, { profileId: MAIN, actionId, slot }, makeInput(code, mods), clock)
}

describe('inputs and layers (FR-12, FR-14)', () => {
  it('orders modifiers and drops the key own modifier', () => {
    expect(layerKey(['alt', 'ctrl'])).toBe('ctrl+alt')
    expect(makeInput('Digit1', ['shift', 'ctrl', 'ctrl'])).toEqual({
      device: 'keyboard',
      code: 'Digit1',
      modifiers: ['ctrl', 'shift'],
    })
    expect(makeInput('ShiftLeft', ['shift', 'ctrl']).modifiers).toEqual(['ctrl'])
    expect(makeInput('Mouse4', []).device).toBe('mouse')
    expect(inputKey(makeInput('KeyE', ['alt']))).toBe('alt|KeyE')
  })

  it('rejects blocked keys and disallowed modifiers (FR-12, step 3)', () => {
    const g = game()
    expect(captureError(g, makeInput('Fn', []))).toEqual({ kind: 'blockedKey' })
    expect(captureError(g, makeInput('MetaLeft', []))).toEqual({ kind: 'blockedKey' })
    expect(captureError(g, makeInput('KeyQ', ['ctrl']))).toBeNull()
    const noAlt = { ...g, rules: { ...g.rules, allowedModifiers: ['ctrl' as const] } }
    expect(captureError(noAlt, makeInput('KeyQ', ['alt', 'ctrl']))).toEqual({
      kind: 'modifierNotAllowed',
      modifiers: ['alt'],
    })
  })
})

describe('assigning bindings (FR-12)', () => {
  it('puts a new binding into the slot with default press type', () => {
    const g = assign(game(), USE, 'KeyF')
    const b = bindingInSlot(profile(g), USE, 1)
    expect(b?.input.code).toBe('KeyF')
    expect(b?.pressType).toBe('press')
    expect(profile(g).updatedAt).not.toBe(profile(game()).updatedAt)
  })

  it('replaces the key in a slot and keeps press type and parameter', () => {
    let g = assign(game(), USE, 'KeyF')
    const id = at(profile(g).bindings, 1).id
    g = setPressType(g, MAIN, id, 'hold', LATER)
    g = assign(g, USE, 'KeyG')
    const b = bindingInSlot(profile(g), USE, 1)
    expect(b).toMatchObject({ id, pressType: 'hold', input: { code: 'KeyG' } })
  })

  it('moves the same input from the other slot of the action', () => {
    let g = assign(game(), USE, 'KeyF', 1)
    g = assign(g, USE, 'KeyF', 2)
    expect(bindingInSlot(profile(g), USE, 1)).toBeUndefined()
    expect(bindingInSlot(profile(g), USE, 2)?.input.code).toBe('KeyF')
  })

  it('keeps the game when nothing changes', () => {
    const g = assign(game(), USE, 'KeyF')
    expect(assign(g, USE, 'KeyF')).toBe(g)
    const id = at(profile(g).bindings, 1).id
    expect(setPressType(g, MAIN, id, 'press', LATER)).toBe(g)
    expect(removeBindings(g, MAIN, ['nope'], LATER)).toBe(g)
  })

  it('finds the first free slot by the game rule (TC-02)', () => {
    let g: Game = { ...game(), rules: { ...game().rules, maxKeysPerAction: 1 } }
    expect(freeSlot(g, profile(g), USE)).toBe(1)
    g = assign(g, USE, 'KeyQ')
    expect(freeSlot(g, profile(g), USE)).toBeNull()
    const two = assign(game(), USE, 'KeyQ')
    expect(freeSlot(two, profile(two), USE)).toBe(2)
  })

  it('sets and clears the parameter', () => {
    let g: Game = {
      ...assign(game(), USE, 'KeyF'),
      bindParam: {
        name: 'Режим каста',
        options: [
          { id: '88888888-8888-4888-8888-888888888881', name: 'Обычный' },
          { id: '88888888-8888-4888-8888-888888888882', name: 'Быстрый' },
        ],
      },
    }
    const id = at(profile(g).bindings, 1).id
    g = setBindingParam(g, MAIN, id, '88888888-8888-4888-8888-888888888882', LATER)
    expect(hasCustomParam(g, at(profile(g).bindings, 1))).toBe(true)
    g = setBindingParam(g, MAIN, id, undefined, LATER)
    expect('paramOptionId' in at(profile(g).bindings, 1)).toBe(false)
  })

  it('lists bindings of a key with the current layer first', () => {
    let g = assign(game(), USE, 'KeyE', 1, ['ctrl'])
    g = assign(g, HORN, 'KeyE')
    expect(bindingsOnInput(profile(g), 'KeyE', '').map((b) => b.actionId)).toEqual([HORN, USE])
    expect(bindingsOnInput(profile(g), 'KeyE', 'ctrl').map((b) => b.actionId)).toEqual([USE, HORN])
  })
})

describe('conflicts and rule violations (FR-15)', () => {
  it('«Везде» overlaps with every context', () => {
    const g = game()
    expect(contextsOverlap(g, GLOBAL, VEHICLE)).toBe(true)
    expect(contextsOverlap(g, ON_FOOT, ON_FOOT)).toBe(true)
    expect(contextsOverlap(g, ON_FOOT, VEHICLE)).toBe(false)
  })

  it('TC-03: one key on foot and in a vehicle is not a conflict', () => {
    let g = assign(game(), ENTER, 'KeyE')
    g = assign(g, HORN, 'KeyE')
    expect(findIssues(g, profile(g)).count).toBe(0)
  })

  it('TC-04: «Везде» and «В транспорте» on one key is one conflict', () => {
    let g = assign(game(), USE, 'KeyE')
    g = assign(g, HORN, 'KeyE')
    const issues = findIssues(g, profile(g))
    expect(issues.count).toBe(1)
    expect(issues.conflicts[0]?.bindings.map((b) => b.actionId).sort()).toEqual([USE, HORN].sort())
    const horn = bindingInSlot(profile(g), HORN, 1)
    expect(conflictsWith(g, profile(g), horn?.id ?? '').map((b) => b.actionId)).toEqual([USE])
  })

  it('different press type or modifiers are not a conflict', () => {
    let g = assign(game(), USE, 'KeyE')
    g = assign(g, HORN, 'KeyE', 1, ['ctrl'])
    expect(findIssues(g, profile(g)).count).toBe(0)
    g = assign(g, HORN, 'KeyE')
    const horn = bindingInSlot(profile(g), HORN, 1)
    g = setPressType(g, MAIN, horn?.id ?? '', 'hold', LATER)
    expect(findIssues(g, profile(g)).count).toBe(0)
  })

  it('two slots of one action on one key are not a conflict', () => {
    const g = game()
    const p = profile(g)
    const twice: Profile = {
      ...p,
      bindings: [
        {
          id: '77777777-7777-4777-8777-777777777781',
          actionId: USE,
          input: makeInput('KeyE', []),
          pressType: 'press',
          slot: 1,
        },
        {
          id: '77777777-7777-4777-8777-777777777782',
          actionId: USE,
          input: makeInput('KeyE', []),
          pressType: 'press',
          slot: 2,
        },
      ],
    }
    expect(findIssues(g, twice).conflicts).toEqual([])
  })

  it('marks extra slots, disallowed modifiers and blocked keys without removing them', () => {
    let g = assign(game(), USE, 'KeyE', 2, ['alt'])
    g = assign(g, HORN, 'KeyH')
    g = {
      ...g,
      rules: {
        maxKeysPerAction: 1,
        allowedModifiers: ['ctrl'],
        blockedKeys: ['Fn', 'Knob', 'KeyH'],
      },
    }
    const issues = findIssues(g, profile(g))
    expect(issues.violations.map((v) => v.kind).sort()).toEqual([
      'blockedKey',
      'extraSlot',
      'modifierNotAllowed',
    ])
    expect(issues.count).toBe(3)
    expect(profile(g).bindings).toHaveLength(3)
  })

  it('NFR-03: 500 bindings take less than 50 ms', () => {
    const g = game()
    const actions = Array.from({ length: 500 }, (_, i) =>
      action(`a-${i}`, `Действие ${i}`, [GLOBAL, ON_FOOT, VEHICLE][i % 3] ?? GLOBAL, i),
    )
    const codes = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG']
    const mods = [[], ['ctrl'], ['shift'], ['alt'], ['ctrl', 'shift']] as const
    const bindings: Binding[] = actions.map((a, i) => ({
      id: `b-${i}`,
      actionId: a.id,
      input: makeInput(codes[i % codes.length] ?? 'KeyQ', mods[i % mods.length] ?? []),
      pressType: 'press',
      slot: 1,
    }))
    const big = { ...g, actions }
    const p = { ...profile(g), bindings }
    findIssues(big, p)
    const start = performance.now()
    const issues = findIssues(big, p)
    expect(performance.now() - start).toBeLessThan(50)
    expect(issues.count).toBeGreaterThan(0)
  })
})

describe('layers (FR-14) and search highlight (FR-16)', () => {
  it('always shows single modifiers and adds combinations in use', () => {
    let g = assign(game(), USE, 'Digit1', 1, ['ctrl'])
    g = assign(g, HORN, 'Digit2', 1, ['shift', 'ctrl'])
    const layers = profileLayers(profile(g), findIssues(g, profile(g)))
    expect(layers.map((l) => [l.key, l.count])).toEqual([
      ['', 1],
      ['ctrl', 1],
      ['shift', 0],
      ['alt', 0],
      ['ctrl+shift', 1],
    ])
  })

  it('TC-05: Ctrl+1 is in the Ctrl layer, not in the base one', () => {
    const g = assign(game(), USE, 'Digit1', 1, ['ctrl'])
    expect(layerInputs(profile(g), 'ctrl')).toEqual(['Digit1'])
    expect(layerInputs(profile(g), '')).toEqual(['Space'])
  })

  it('switches the layer when the action has no keys in the current one', () => {
    const g = assign(game(), USE, 'Digit1', 1, ['ctrl'])
    expect(actionHighlight(profile(g), USE, '')).toEqual({ layer: 'ctrl', codes: ['Digit1'] })
    expect(actionHighlight(profile(g), JUMP, '')).toEqual({ layer: '', codes: ['Space'] })
    expect(actionHighlight(profile(g), HORN, 'alt')).toEqual({ layer: 'alt', codes: [] })
  })
})

describe('key paint (FR-26, FR-30)', () => {
  it('TC-01: a key gets the colour of its action category', () => {
    let g = assign(game(), USE, 'KeyQ')
    g = assign(g, ENTER, 'KeyQ', 1)
    g = assign(g, HORN, 'KeyQ')
    const paint = paintInputs({
      game: g,
      profile: profile(g),
      layer: '',
      colorMode: 'category',
      issues: findIssues(g, profile(g)),
    }).get('KeyQ')
    expect(paint).toMatchObject({
      colors: ['#EF4444', null, '#3B82F6'],
      label: 'ВЗА',
      title: 'Взаимодействие',
      extra: 2,
      bound: true,
      conflict: true,
    })
  })

  it('TC-13: by groups only grouped keys are coloured', () => {
    const base = game()
    const g: Game = {
      ...base,
      profiles: [
        {
          ...profile(base),
          keyGroups: [
            {
              id: '99999999-9999-4999-8999-999999999991',
              name: 'Движение',
              color: '#22C55E',
              inputs: ['KeyW', 'KeyA', 'KeyS', 'KeyD'],
            },
          ],
        },
      ],
    }
    const paint = paintInputs({
      game: g,
      profile: profile(g),
      layer: '',
      colorMode: 'group',
      issues: findIssues(g, profile(g)),
    })
    expect(paint.get('KeyW')?.colors).toEqual(['#22C55E'])
    expect(paint.get('Space')?.colors).toEqual([])
    expect(paint.get('Space')?.label).toBe('ПРЫ')
  })
})
