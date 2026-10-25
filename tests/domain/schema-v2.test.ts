import { describe, expect, it } from 'vitest'
import { addAction, updateAction } from '@/domain/actions'
import { parseAppData } from '@/domain/app-data'
import { assignBinding, commonParam, makeInput, setParamForActions } from '@/domain/bindings'
import { conflictsForInput } from '@/domain/conflicts'
import { columnLayout, singleColumn } from '@/domain/layout'
import { appDataSchema } from '@/domain/schema'
import {
  coerceSettingValue,
  emptySettingDraft,
  settingDraftErrors,
} from '@/domain/settings-template'
import { setSettingValue } from '@/domain/setting-values'
import { abbreviate, shortLabelOf } from '@/domain/short-label'
import type { Game } from '@/domain/types'
import { at, sampleData, sampleGame, testClock } from '../fixtures'

const LATER = '2026-10-23T10:00:00.000Z'
const MAIN = '66666666-6666-4666-8666-666666666661'
const JUMP = '44444444-4444-4444-8444-444444444441'
const GLOBAL = '22222222-2222-4222-8222-222222222220'
const ON_FOOT = '22222222-2222-4222-8222-222222222221'

describe('schema v2', () => {
  it('migrates v1 data without changes except the version', () => {
    const v1 = { ...sampleData(), schemaVersion: 1 }
    const result = parseAppData(JSON.stringify(v1))
    expect(result).toMatchObject({ kind: 'ok', migratedFrom: 1 })
    if (result.kind === 'ok') {
      expect(result.data.games).toEqual(sampleData().games)
      expect(result.data.appSettings).toMatchObject({ showKeyboard: true, showMouse: true })
    }
  })

  it('accepts layout fields, short labels and info settings', () => {
    const game = sampleGame()
    const withLayout: Game = {
      ...game,
      categories: game.categories.map((c) => ({ ...c, note: 'Пояснение', display: 'slots' })),
      actions: game.actions.map((a) => ({ ...a, short: 'ПР', column: 2, subgroup: 'Союзники' })),
      settingsTemplate: [
        ...game.settingsTemplate,
        {
          id: '55555555-5555-4555-8555-555555555552',
          group: 'Мини-карта',
          name: 'Схема',
          type: 'info',
          text: 'Мини-карта слева',
          height: 6,
          column: 2,
          order: 1,
        },
      ],
    }
    expect(appDataSchema.safeParse({ ...sampleData(), games: [withLayout] }).success).toBe(true)
    const tooLong = { ...game, actions: game.actions.map((a) => ({ ...a, short: 'ДЛИННО' })) }
    expect(appDataSchema.safeParse({ ...sampleData(), games: [tooLong] }).success).toBe(false)
  })
})

describe('info settings have no value', () => {
  const info = {
    id: '55555555-5555-4555-8555-555555555552',
    group: 'Мини-карта',
    name: 'Схема',
    type: 'info' as const,
    text: 'Текст',
    order: 1,
  }

  it('never stores a value and checks the text length', () => {
    expect(coerceSettingValue(info, 'x')).toBeUndefined()
    const game = { ...sampleGame(), settingsTemplate: [...sampleGame().settingsTemplate, info] }
    expect(setSettingValue(game, MAIN, info.id, 'x', LATER)).toBe(game)
    const draft = emptySettingDraft('info', 'Мини-карта', testClock())
    expect(draft).toMatchObject({ type: 'info', text: '' })
    if (draft.type !== 'info') throw new Error('info draft expected')
    expect(settingDraftErrors({ ...draft, name: 'Схема', text: 'x'.repeat(501) })).toEqual({
      text: true,
    })
  })
})

describe('short labels (FR-26)', () => {
  it('abbreviates names', () => {
    expect(abbreviate('Способность 1')).toBe('СП1')
    expect(abbreviate('Изучить левый талант')).toBe('ИЛТ')
    expect(abbreviate('Взаимодействие')).toBe('ВЗА')
    expect(abbreviate('Выбрать 1-й нейтральный предмет')).toBe('ВН1')
    expect(abbreviate('Прыжок / перелезть')).toBe('ПП')
    expect(abbreviate('Сдвинуть камеру в направлении вверх')).toBe('СКН')
    expect(abbreviate('10-я группа')).toBe('ГР10')
  })

  it('prefers the own short label', () => {
    expect(shortLabelOf({ name: 'Ультимейт', short: 'УЛЬТ' })).toBe('УЛЬТ')
    expect(shortLabelOf({ name: 'Ультимейт' })).toBe('УЛЬ')
  })

  it('editing an action keeps its short label and layout', () => {
    const clock = testClock()
    let game = addAction(sampleGame(), clock, {
      name: 'Способность 1',
      contextId: GLOBAL,
      short: ' СП1 ',
      column: 2,
      subgroup: 'Способности',
    })
    const added = at(game.actions, 1)
    expect(added).toMatchObject({ short: 'СП1', column: 2, subgroup: 'Способности' })
    game = updateAction(game, added.id, { ...added, name: 'Способность первая' })
    expect(at(game.actions, 1)).toMatchObject({ short: 'СП1', column: 2, subgroup: 'Способности' })
  })
})

describe('column layout', () => {
  it('keeps explicit columns and subgroups in order', () => {
    const items = [
      { id: 'a', column: 1 as const },
      { id: 'b', column: 2 as const },
      { id: 'c', column: 1 as const },
      { id: 'd', column: 2 as const, subgroup: 'Союзники' },
      { id: 'e', column: 1 as const, subgroup: 'Союзники' },
    ]
    const blocks = columnLayout(items)
    expect(
      blocks.map((b) => [b.subgroup, b.left.map((i) => i.id), b.right.map((i) => i.id)]),
    ).toEqual([
      [null, ['a', 'c'], ['b']],
      ['Союзники', ['e'], ['d']],
    ])
    expect(singleColumn(at(blocks, 0)).map((i) => i.id)).toEqual(['a', 'c', 'b'])
  })

  it('splits in half without columns', () => {
    const items: { id: number; column?: 1 | 2 }[] = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const [block] = columnLayout(items)
    expect(block?.left.map((i) => i.id)).toEqual([1, 2])
    expect(block?.right.map((i) => i.id)).toEqual([3])
  })
})

describe('bind dialog helpers (FR-12)', () => {
  function game(): Game {
    const g = sampleGame()
    return {
      ...g,
      actions: [
        ...g.actions,
        { id: '44444444-4444-4444-8444-444444444442', name: 'Огонь', contextId: GLOBAL, order: 1 },
      ],
      bindParam: {
        name: 'Режим каста',
        options: [
          { id: '88888888-8888-4888-8888-888888888881', name: 'Обычное' },
          { id: '88888888-8888-4888-8888-888888888882', name: 'Быстрое' },
        ],
      },
    }
  }
  const FIRE = '44444444-4444-4444-8444-444444444442'
  const QUICK = '88888888-8888-4888-8888-888888888882'

  it('finds conflicts of a binding before it is saved', () => {
    const g = game()
    const p = at(g.profiles, 0)
    const space = makeInput('Space', [])
    expect(conflictsForInput(g, p, { actionId: FIRE, slot: 1 }, space, 'press')).toHaveLength(1)
    expect(conflictsForInput(g, p, { actionId: FIRE, slot: 1 }, space, 'hold')).toEqual([])
    // Свой слот не считается: Space у прыжка — это он сам
    expect(conflictsForInput(g, p, { actionId: JUMP, slot: 1 }, space, 'press')).toEqual([])
    expect(ON_FOOT).toBeTruthy()
  })

  it('sets one cast mode for a group of actions', () => {
    let g = assignBinding(
      game(),
      { profileId: MAIN, actionId: FIRE, slot: 1 },
      makeInput('KeyF', []),
      testClock(LATER),
    )
    expect(commonParam(g, at(g.profiles, 0), [JUMP, FIRE])).toBe(
      '88888888-8888-4888-8888-888888888881',
    )
    g = setParamForActions(g, MAIN, [JUMP, FIRE], QUICK, LATER)
    expect(at(g.profiles, 0).bindings.every((b) => b.paramOptionId === QUICK)).toBe(true)
    expect(commonParam(g, at(g.profiles, 0), [JUMP, FIRE])).toBe(QUICK)
    expect(setParamForActions(g, MAIN, [JUMP, FIRE], QUICK, LATER)).toBe(g)
    g = setParamForActions(g, MAIN, [JUMP], '88888888-8888-4888-8888-888888888881', LATER)
    expect('paramOptionId' in at(at(g.profiles, 0).bindings, 0)).toBe(false)
    expect(commonParam(g, at(g.profiles, 0), [JUMP, FIRE])).toBeNull()
  })
})
