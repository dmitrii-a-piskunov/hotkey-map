import { describe, expect, it } from 'vitest'
import { issuePlace, parseImportFile } from '@/domain/import-file'
import { CURRENT_SCHEMA_VERSION } from '@/domain/schema'
import { ru } from '@/i18n/ru'
import { at, sampleGame, T } from '../fixtures'

function fileText(games: unknown[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    scope: 'all',
    exportedAt: T,
    games,
    ...extra,
  })
}

describe('parseImportFile (TC-10)', () => {
  it('accepts a valid file and migrates an older one', () => {
    expect(parseImportFile(fileText([sampleGame()])).kind).toBe('ok')
    const v3 = JSON.parse(fileText([sampleGame()])) as Record<string, unknown>
    const r = parseImportFile(JSON.stringify({ ...v3, schemaVersion: 3 }))
    expect(r.kind).toBe('ok')
  })

  it('reports text that is not JSON, has no version or is not an object', () => {
    expect(parseImportFile('{"games": [')).toEqual({
      kind: 'invalid',
      issues: [{ place: '', message: ru.import.notJson }],
    })
    expect(parseImportFile('{"games": []}')).toEqual({
      kind: 'invalid',
      issues: [{ place: '', message: ru.import.noVersion }],
    })
    expect(parseImportFile('[1, 2]')).toEqual({
      kind: 'invalid',
      issues: [{ place: '', message: ru.import.notObject }],
    })
  })

  it('tells about a file from a newer app version', () => {
    expect(parseImportFile('{"schemaVersion": 99}')).toEqual({ kind: 'newer', version: 99 })
  })

  it('names the game and the action where the structure is broken', () => {
    const game = sampleGame()
    const broken = {
      ...game,
      actions: [{ ...at(game.actions, 0), contextId: '99999999-9999-4999-8999-999999999999' }],
    }
    const r = parseImportFile(fileText([broken]))
    expect(r.kind).toBe('invalid')
    if (r.kind !== 'invalid') return
    expect(r.issues).toContainEqual({
      place: 'Игра «PUBG» → действие «Прыжок» → contextId',
      message: ru.dataErrors.unknownContext,
    })
  })

  it('numbers items without a name and speaks Russian for type errors', () => {
    const game = sampleGame()
    const profile = at(game.profiles, 0)
    const broken = {
      ...game,
      profiles: [{ ...profile, bindings: [{ ...at(profile.bindings, 0), slot: 'one' }] }],
    }
    const r = parseImportFile(fileText([broken]))
    if (r.kind !== 'invalid') throw new Error('expected errors')
    const issue = at(r.issues, 0)
    expect(issue.place).toBe('Игра «PUBG» → профиль «Основной» → бинд 1 → slot')
    expect(issue.message).toMatch(/[а-я]/i)
  })
})

describe('issuePlace', () => {
  it('handles icons, missing items and plain fields', () => {
    expect(issuePlace(['icons', 'a.png'], {})).toBe('Иконка a.png')
    expect(issuePlace(['games', 3, 'name'], { games: [] })).toBe('Игра 4 → name')
    expect(issuePlace(['scope'], {})).toBe('Scope')
    expect(issuePlace([], {})).toBe('')
  })
})
