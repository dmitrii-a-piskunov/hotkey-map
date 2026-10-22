import { describe, expect, it } from 'vitest'
import { createAppData } from '@/domain/app-data'
import {
  bindParamErrors,
  bindParamImpact,
  hasBindParamErrors,
  keptOptionIds,
  removeBindParam,
  setBindParam,
} from '@/domain/bind-param'
import {
  addProfile,
  canRemoveProfile,
  duplicateProfile,
  newProfile,
  profileNameError,
  removeProfile,
  renameProfile,
  setProfileNotes,
} from '@/domain/profiles'
import { appDataSchema } from '@/domain/schema'
import {
  addSetting,
  coerceSettingValue,
  emptySettingDraft,
  moveSetting,
  removeSetting,
  settingDraftErrors,
  settingSections,
  settingUpdateImpact,
  sliderRangeChanged,
  snapToSlider,
  updateSetting,
  type SettingDraft,
} from '@/domain/settings-template'
import type { Game, SettingDef } from '@/domain/types'
import { at, sampleGame, T, testClock } from '../fixtures'

const LATER = '2026-10-23T10:00:00.000Z'
const MAIN = '66666666-6666-4666-8666-666666666661'
const SENS = '55555555-5555-4555-8555-555555555551'

function valid(game: Game): boolean {
  return appDataSchema.safeParse({ ...createAppData(), games: [game] }).success
}

describe('profiles (FR-11)', () => {
  it('creates, renames and keeps notes', () => {
    const clock = testClock(LATER)
    let game = addProfile(sampleGame(), newProfile(clock, ' Гость '))
    const guest = at(game.profiles, 1)
    expect(guest).toMatchObject({ name: 'Гость', notes: '', bindings: [], createdAt: LATER })
    game = renameProfile(game, guest.id, 'Друг', LATER)
    game = setProfileNotes(game, MAIN, 'Сенса 42', LATER)
    expect(game.profiles.map((p) => p.name)).toEqual(['Основной', 'Друг'])
    expect(at(game.profiles, 0)).toMatchObject({ notes: 'Сенса 42', updatedAt: LATER })
    expect(valid(game)).toBe(true)
  })

  it('names are unique in a game and up to 40 characters', () => {
    expect(profileNameError(sampleGame(), 'основной')).toBe('duplicate')
    expect(profileNameError(sampleGame(), 'Основной', MAIN)).toBeNull()
    expect(profileNameError(sampleGame(), 'a'.repeat(41))).toBe('tooLong')
  })

  it('duplicates bindings, values, notes and key groups with new ids', () => {
    const clock = testClock(LATER)
    let game = setProfileNotes(sampleGame(), MAIN, 'заметка', T)
    game = {
      ...game,
      profiles: game.profiles.map((p) => ({
        ...p,
        keyGroups: [
          {
            id: '88888888-8888-4888-8888-888888888881',
            name: 'WASD',
            color: '#10B981',
            inputs: ['KeyW'],
          },
        ],
      })),
    }
    const copy = duplicateProfile(game, MAIN, clock)
    const source = at(game.profiles, 0)
    expect(copy.name).toBe('Копия Основной')
    expect(copy.notes).toBe('заметка')
    expect(copy.settingValues).toEqual(source.settingValues)
    expect(copy.bindings.map((b) => b.input)).toEqual(source.bindings.map((b) => b.input))
    expect(at(copy.bindings, 0).id).not.toBe(at(source.bindings, 0).id)
    expect(at(copy.keyGroups, 0)).toMatchObject({ name: 'WASD', inputs: ['KeyW'] })
    expect(at(copy.keyGroups, 0).id).not.toBe(at(source.keyGroups, 0).id)
    game = addProfile(game, copy)
    expect(duplicateProfile(game, MAIN, clock).name).toBe('Копия Основной (2)')
    expect(valid(game)).toBe(true)
    expect(() => duplicateProfile(game, 'missing', clock)).toThrow()
  })

  it('the last profile cannot be removed', () => {
    const game = sampleGame()
    expect(canRemoveProfile(game)).toBe(false)
    expect(() => removeProfile(game, MAIN)).toThrow()
    const two = addProfile(game, newProfile(testClock(), 'Гость'))
    expect(removeProfile(two, MAIN).profiles.map((p) => p.name)).toEqual(['Гость'])
  })
})

describe('bind parameter (FR-09)', () => {
  function withParam() {
    const clock = testClock()
    const game = setBindParam(sampleGame(), clock, {
      name: ' Режим каста ',
      options: [{ name: 'Обычный' }, { name: 'Быстрый' }],
    })
    const [normal, quick] = game.bindParam?.options ?? []
    if (!normal || !quick) throw new Error('no options')
    const bound: Game = {
      ...game,
      profiles: game.profiles.map((p) => ({
        ...p,
        bindings: p.bindings.map((b) => ({ ...b, paramOptionId: quick.id })),
      })),
    }
    return { game: bound, normal, quick, clock }
  }

  it('creates the parameter with option ids', () => {
    const { game } = withParam()
    expect(game.bindParam?.name).toBe('Режим каста')
    expect(valid(game)).toBe(true)
  })

  it('removing an option takes it off the bindings', () => {
    const { game, normal, quick, clock } = withParam()
    const draft = {
      name: 'Режим',
      options: [{ id: normal.id, name: 'Обычный' }, { name: 'Новый' }],
    }
    expect(bindParamImpact(game, keptOptionIds(draft))).toBe(1)
    const next = setBindParam(game, clock, draft)
    expect(at(at(next.profiles, 0).bindings, 0).paramOptionId).toBeUndefined()
    expect(next.bindParam?.options.map((o) => o.name)).toEqual(['Обычный', 'Новый'])
    expect(bindParamImpact(game, new Set([quick.id]))).toBe(0)
    expect(valid(next)).toBe(true)
  })

  it('removing the parameter clears all bindings', () => {
    const { game } = withParam()
    expect(bindParamImpact(game, null)).toBe(1)
    const next = removeBindParam(game)
    expect(next.bindParam).toBeUndefined()
    expect(at(at(next.profiles, 0).bindings, 0).paramOptionId).toBeUndefined()
    expect(removeBindParam(next)).toBe(next)
    expect(valid(next)).toBe(true)
  })

  it('validates name and options', () => {
    expect(hasBindParamErrors(bindParamErrors({ name: 'A', options: [{ name: 'x' }] }))).toBe(false)
    const errors = bindParamErrors({
      name: '',
      options: [{ name: 'x' }, { name: 'X' }, { name: '' }],
    })
    expect(errors).toEqual({ name: 'required', options: [null, 'duplicate', 'required'] })
    expect(bindParamErrors({ name: 'A', options: [] }).noOptions).toBe(true)
  })
})

describe('settings template (FR-10)', () => {
  const slider = (min: number, max: number, step: number, defaultValue: number): SettingDraft => ({
    type: 'slider',
    group: 'Мышь',
    name: 'Чувствительность',
    min,
    max,
    step,
    defaultValue,
  })

  it('snaps slider values to range and step', () => {
    expect(snapToSlider(150, { min: 0, max: 100, step: 1 })).toBe(100)
    expect(snapToSlider(-3, { min: 0, max: 100, step: 1 })).toBe(0)
    expect(snapToSlider(0.35, { min: 0, max: 1, step: 0.1 })).toBe(0.4)
    expect(snapToSlider(0.7, { min: 0.5, max: 2, step: 0.05 })).toBe(0.7)
    expect(snapToSlider(9, { min: 0, max: 10, step: 3 })).toBe(9)
    expect(snapToSlider(10, { min: 0, max: 10, step: 3 })).toBe(9)
  })

  it('coerces values to the type of the setting', () => {
    const def: SettingDef = { ...slider(1, 10, 1, 5), id: SENS, order: 0 }
    expect(coerceSettingValue(def, 42)).toBe(10)
    expect(coerceSettingValue(def, true)).toBeUndefined()
    const toggle: SettingDef = {
      id: SENS,
      order: 0,
      group: 'g',
      name: 'n',
      type: 'toggle',
      defaultValue: false,
    }
    expect(coerceSettingValue(toggle, true)).toBe(true)
    expect(coerceSettingValue(toggle, 1)).toBeUndefined()
    const text: SettingDef = {
      id: SENS,
      order: 0,
      group: 'g',
      name: 'n',
      type: 'text',
      defaultValue: '',
    }
    expect(coerceSettingValue(text, 'abc')).toBe('abc')
    expect(coerceSettingValue(text, 'a'.repeat(201))).toBeUndefined()
  })

  it('narrowing the slider range brings profile values into it and warns', () => {
    const game = sampleGame()
    const draft = slider(1, 40, 1, 20)
    const current = at(game.settingsTemplate, 0)
    expect(sliderRangeChanged(current, draft)).toBe(true)
    expect(sliderRangeChanged(current, slider(1, 100, 1, 10))).toBe(false)
    expect(settingUpdateImpact(game, SENS, draft)).toBe(1)
    expect(settingUpdateImpact(game, SENS, slider(1, 100, 2, 50))).toBe(1)
    expect(settingUpdateImpact(game, SENS, slider(0, 200, 1, 50))).toBe(0)
    const next = updateSetting(game, SENS, draft)
    expect(at(next.profiles, 0).settingValues[SENS]).toBe(40)
    expect(valid(next)).toBe(true)
  })

  it('changing the type resets values; removing deletes them', () => {
    const game = sampleGame()
    const toggle: SettingDraft = {
      type: 'toggle',
      group: 'Мышь',
      name: 'Инверсия',
      defaultValue: false,
    }
    expect(settingUpdateImpact(game, SENS, toggle)).toBe(1)
    const next = updateSetting(game, SENS, toggle)
    expect(at(next.profiles, 0).settingValues).toEqual({})
    expect(at(removeSetting(game, SENS).profiles, 0).settingValues).toEqual({})
    expect(removeSetting(game, SENS).settingsTemplate).toEqual([])
  })

  it('a removed select option resets the values that used it', () => {
    const clock = testClock()
    let game = addSetting(sampleGame(), clock, {
      type: 'select',
      group: 'Графика',
      name: 'Качество',
      options: [
        { id: '99999999-9999-4999-8999-999999999991', name: 'Высокое' },
        { id: '99999999-9999-4999-8999-999999999992', name: 'Низкое' },
      ],
      defaultValue: '99999999-9999-4999-8999-999999999991',
    })
    const id = at(game.settingsTemplate, 1).id
    game = {
      ...game,
      profiles: game.profiles.map((p) => ({
        ...p,
        settingValues: { ...p.settingValues, [id]: '99999999-9999-4999-8999-999999999992' },
      })),
    }
    const draft: SettingDraft = {
      type: 'select',
      group: 'Графика',
      name: 'Качество',
      options: [{ id: '99999999-9999-4999-8999-999999999991', name: 'Высокое' }],
      defaultValue: '99999999-9999-4999-8999-999999999991',
    }
    expect(settingUpdateImpact(game, id, draft)).toBe(1)
    expect(at(updateSetting(game, id, draft).profiles, 0).settingValues[id]).toBeUndefined()
  })

  it('groups settings, drag between groups changes the group', () => {
    const clock = testClock()
    let game = addSetting(sampleGame(), clock, {
      type: 'toggle',
      group: 'Графика',
      name: 'Тени',
      defaultValue: true,
    })
    game = addSetting(game, clock, { ...slider(30, 120, 1, 90), name: 'FOV', group: 'Графика' })
    game = addSetting(game, clock, { ...slider(0, 1, 0.1, 0.5), name: 'Ускорение' })
    const group = (g: Game) =>
      settingSections(g).map((s) => [s.group, s.settings.map((d) => d.name)])
    expect(group(game)).toEqual([
      ['Мышь', ['Чувствительность', 'Ускорение']],
      ['Графика', ['Тени', 'FOV']],
    ])
    const fov = at(
      game.settingsTemplate.filter((d) => d.name === 'FOV'),
      0,
    ).id
    game = moveSetting(game, fov, 'Мышь', 0)
    expect(group(game)).toEqual([
      ['Мышь', ['FOV', 'Чувствительность', 'Ускорение']],
      ['Графика', ['Тени']],
    ])
    game = updateSetting(game, fov, { ...slider(30, 120, 1, 90), name: 'FOV', group: 'Камера' })
    expect(group(game).map(([g]) => g)).toEqual(['Мышь', 'Графика', 'Камера'])
    game = moveSetting(game, fov, 'Новая', 0)
    expect(group(game).map(([g]) => g)).toEqual(['Мышь', 'Графика', 'Новая'])
    expect(valid(game)).toBe(true)
  })

  it('validates drafts', () => {
    expect(settingDraftErrors(slider(0, 100, 1, 50))).toEqual({})
    expect(settingDraftErrors(slider(10, 10, 1, 10))).toMatchObject({ range: true, step: true })
    expect(settingDraftErrors(slider(0, 10, 0, 5))).toMatchObject({ step: true })
    expect(settingDraftErrors(slider(0, 10, 1, 11))).toMatchObject({ defaultValue: true })
    expect(settingDraftErrors({ ...slider(0, 10, 1, 5), name: '', group: '' })).toMatchObject({
      name: 'required',
      group: 'required',
    })
    const select = emptySettingDraft('select', 'Графика', testClock())
    expect(settingDraftErrors({ ...select, name: 'Качество' })).toEqual({ options: true })
    expect(
      settingDraftErrors({ type: 'text', group: 'g', name: 'n', defaultValue: 'a'.repeat(201) }),
    ).toEqual({ defaultValue: true })
    expect(
      settingDraftErrors({
        type: 'toggle',
        group: 'g',
        name: 'n',
        unit: 'a'.repeat(21),
        defaultValue: true,
      }),
    ).toEqual({ unit: 'tooLong' })
    expect(emptySettingDraft('slider', 'g', testClock())).toMatchObject({
      min: 0,
      max: 100,
      step: 1,
    })
  })
})
