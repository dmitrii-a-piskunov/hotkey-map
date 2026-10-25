import { describe, expect, it } from 'vitest'
import { addProfile, newProfile } from '@/domain/profiles'
import {
  addToKeyGroup,
  copyConflicts,
  copyKeyGroup,
  createKeyGroup,
  groupOf,
  inputsInOtherGroups,
  keyGroupNameError,
  removeFromKeyGroup,
  removeKeyGroup,
  updateKeyGroup,
} from '@/domain/key-groups'
import {
  fitSliderValue,
  isDefaultValue,
  resetAllSettingValues,
  resetSettingValue,
  setSettingValue,
  settingValueOf,
} from '@/domain/setting-values'
import { appDataSchema } from '@/domain/schema'
import type { Game, SettingDef } from '@/domain/types'
import { at, sampleData, sampleGame, testClock } from '../fixtures'

const LATER = '2026-10-23T10:00:00.000Z'
const MAIN = '66666666-6666-4666-8666-666666666661'
const SENS = '55555555-5555-4555-8555-555555555551'
const GREEN = '#22C55E'

function main(g: Game) {
  return at(g.profiles, 0)
}

describe('key groups (FR-29)', () => {
  it('creates a group from the selection without Fn and the knob', () => {
    const { game, groupId } = createKeyGroup(
      sampleGame(),
      MAIN,
      { name: ' Движение ', color: GREEN },
      ['KeyW', 'KeyA', 'Fn', 'Knob', 'KeyW'],
      testClock(),
    )
    expect(main(game).keyGroups).toEqual([
      { id: groupId, name: 'Движение', color: GREEN, inputs: ['KeyW', 'KeyA'] },
    ])
  })

  it('a key is in one group only: adding moves it', () => {
    const clock = testClock()
    const first = createKeyGroup(
      sampleGame(),
      MAIN,
      { name: 'A', color: GREEN },
      ['KeyW', 'KeyA'],
      clock,
    )
    const a = first.groupId
    let game = first.game
    const second = createKeyGroup(game, MAIN, { name: 'B', color: GREEN }, ['KeyA', 'KeyQ'], clock)
    game = second.game
    expect(groupOf(main(game), 'KeyA')?.id).toBe(second.groupId)
    expect(main(game).keyGroups.find((g) => g.id === a)?.inputs).toEqual(['KeyW'])
    expect(
      inputsInOtherGroups(main(game), ['KeyW', 'KeyE'], second.groupId).map((x) => x.code),
    ).toEqual(['KeyW'])

    game = addToKeyGroup(game, MAIN, a, ['KeyQ'], LATER)
    expect(groupOf(main(game), 'KeyQ')?.id).toBe(a)
    expect(appDataSchema.safeParse({ ...sampleData(), games: [game] }).success).toBe(true)
  })

  it('renames, removes keys and deletes groups', () => {
    const created = createKeyGroup(
      sampleGame(),
      MAIN,
      { name: 'A', color: GREEN },
      ['KeyW', 'KeyA'],
      testClock(),
    )
    const { groupId } = created
    let game = updateKeyGroup(created.game, MAIN, groupId, { name: 'Б', color: '#000000' }, LATER)
    expect(main(game).keyGroups[0]).toMatchObject({ name: 'Б', color: '#000000' })
    game = removeFromKeyGroup(game, MAIN, groupId, ['KeyW'], LATER)
    expect(main(game).keyGroups[0]?.inputs).toEqual(['KeyA'])
    expect(removeFromKeyGroup(game, MAIN, groupId, ['KeyZ'], LATER)).toBe(game)
    game = removeKeyGroup(game, MAIN, groupId, LATER)
    expect(main(game).keyGroups).toEqual([])
  })

  it('copies a group into another profile of the game', () => {
    const clock = testClock()
    const other = newProfile(clock, 'Второй')
    let game = addProfile(sampleGame(), other)
    const target = createKeyGroup(
      game,
      other.id,
      { name: 'Движение', color: '#000000' },
      ['KeyW'],
      clock,
    )
    game = target.game
    const source = createKeyGroup(
      game,
      MAIN,
      { name: 'Движение', color: GREEN },
      ['KeyW', 'KeyA'],
      clock,
    )
    game = source.game
    expect(copyConflicts(game, MAIN, source.groupId, other.id).map((x) => x.code)).toEqual(['KeyW'])

    game = copyKeyGroup(game, MAIN, source.groupId, other.id, clock)
    const groups = at(game.profiles, 1).keyGroups
    expect(groups.map((g) => [g.name, g.inputs])).toEqual([
      ['Движение', []],
      ['Движение (2)', ['KeyW', 'KeyA']],
    ])
    expect(at(groups, 1).id).not.toBe(source.groupId)
  })

  it('checks the name length', () => {
    expect(keyGroupNameError(' ')).toBe('required')
    expect(keyGroupNameError('x'.repeat(41))).toBe('tooLong')
    expect(keyGroupNameError('Способности')).toBeNull()
  })
})

describe('setting values (FR-18)', () => {
  const def = at(sampleGame().settingsTemplate, 0) as Extract<SettingDef, { type: 'slider' }>

  it('TC-08: 150 in a 0–100 field becomes 100 with a hint', () => {
    expect(fitSliderValue({ ...def, min: 0, max: 100 }, 150)).toEqual({ value: 100, clamped: true })
    expect(fitSliderValue({ ...def, step: 5 }, 42)).toEqual({ value: 41, clamped: false })
  })

  it('keeps values per profile and resets to the default', () => {
    const clock = testClock()
    const other = newProfile(clock, 'Второй')
    let game = addProfile(sampleGame(), other)
    game = setSettingValue(game, MAIN, SENS, 77.4, LATER)
    expect(settingValueOf(def, main(game))).toBe(77)
    expect(settingValueOf(def, at(game.profiles, 1))).toBe(50)
    expect(isDefaultValue(def, at(game.profiles, 1))).toBe(true)

    expect(setSettingValue(game, MAIN, SENS, 'text', LATER)).toBe(game)
    game = resetSettingValue(game, MAIN, SENS, LATER)
    expect(main(game).settingValues).toEqual({})
    expect(resetSettingValue(game, MAIN, SENS, LATER)).toBe(game)
  })
})

describe('reset all setting values (FR-18)', () => {
  it('clears the values of one profile and keeps the game when nothing is set', () => {
    let game = setSettingValue(sampleGame(), MAIN, SENS, 70, LATER)
    game = resetAllSettingValues(game, MAIN, LATER)
    expect(main(game).settingValues).toEqual({})
    expect(resetAllSettingValues(game, MAIN, LATER)).toBe(game)
  })
})
