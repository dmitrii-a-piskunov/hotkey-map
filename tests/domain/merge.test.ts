import { describe, expect, it } from 'vitest'
import { createAppData } from '@/domain/app-data'
import type { Clock } from '@/domain/clock'
import { buildExport } from '@/domain/export'
import { copyGame } from '@/domain/games'
import { applyImport, previewImport, type ImportChoices } from '@/domain/merge'
import { appDataSchema, CURRENT_SCHEMA_VERSION } from '@/domain/schema'
import type { AppData, ExportFile, Game, Profile, SettingDef } from '@/domain/types'
import { at, sampleData, sampleGame, T, testClock } from '../fixtures'

const JUMP = '44444444-4444-4444-8444-444444444441'
const MAIN = '66666666-6666-4666-8666-666666666661'
const SENS = '55555555-5555-4555-8555-555555555551'

/** Id другого вида, чем у testClock: файл «с другого компьютера» */
function fileClock(): Clock {
  let n = 0
  return {
    id: () => `aaaaaaaa-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}`,
    now: () => T,
  }
}

function fileOf(games: Game[], scope: ExportFile['scope'] = 'game'): ExportFile {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, scope, exportedAt: T, games }
}

/** Та же игра, но с другими id — как созданная заново на другом компьютере */
function sameGameOtherIds(game: Game = sampleGame()): Game {
  return copyGame(game, fileClock(), [])
}

function run(data: AppData, file: ExportFile, choices: ImportChoices = {}, icons = {}) {
  const r = applyImport(data, file, choices, testClock(), icons)
  if (r.kind !== 'ok') throw new Error(r.messages.join('\n'))
  expect(appDataSchema.safeParse(r.data).success).toBe(true)
  return r
}

const game0 = (data: AppData) => at(data.games, 0)
const profile0 = (data: AppData) => at(game0(data).profiles, 0)

describe('import into an empty app (TC-09)', () => {
  it('restores games and app settings from a full export', () => {
    const source: AppData = {
      ...sampleData(),
      appSettings: { ...sampleData().appSettings, theme: 'dark', view: '2d' },
    }
    const file = buildExport(source, { scope: 'all' }, new Date(T))
    if (!file) throw new Error('no file')
    const { data, report } = run(createAppData(), file)
    expect(data.games).toEqual(source.games)
    expect(data.appSettings).toMatchObject({ theme: 'dark', view: '2d', lastExportAt: T })
    expect(report).toMatchObject({ gamesAdded: 1, profilesAdded: 1, bindingsAdded: 1 })
  })

  it('keeps current app settings when the app already has games', () => {
    const file = {
      ...fileOf([sameGameOtherIds({ ...sampleGame(), name: 'Dota 2' })], 'all'),
      appSettings: { ...createAppData().appSettings, theme: 'dark' as const },
    }
    const { data } = run(sampleData(), file)
    expect(data.appSettings.theme).toBe('system')
    expect(previewImport(sampleData(), file).appSettings).toBe(false)
    expect(previewImport(createAppData(), file).appSettings).toBe(true)
  })
})

describe('new games', () => {
  it('adds an unmatched game with its ids and a written icon', () => {
    const dota = { ...sameGameOtherIds(), name: 'Dota 2', icon: 'dota-old.png' }
    const { data, report } = run(sampleData(), fileOf([dota]), {}, { 'dota-old.png': 'x-1.png' })
    expect(data.games.map((g) => g.name)).toEqual(['PUBG', 'Dota 2'])
    expect(at(data.games, 1)).toEqual({ ...dota, icon: 'x-1.png' })
    expect(report.gamesAdded).toBe(1)
  })

  it('drops an icon that was not written', () => {
    const dota = { ...sameGameOtherIds(), name: 'Dota 2', icon: 'missing.png' }
    const { data } = run(sampleData(), fileOf([dota]))
    expect(at(data.games, 1).icon).toBeUndefined()
  })
})

describe('game strategies', () => {
  it('copy: new ids everywhere and a numbered name', () => {
    const { data, report } = run(sampleData(), fileOf([sampleGame()]), {
      [sampleGame().id]: { strategy: 'copy', profiles: {} },
    })
    const copy = at(data.games, 1)
    expect(copy.name).toBe('PUBG (2)')
    expect(copy.id).not.toBe(sampleGame().id)
    expect(at(copy.actions, 0).id).not.toBe(JUMP)
    expect(at(at(copy.profiles, 0).bindings, 0).actionId).toBe(at(copy.actions, 0).id)
    expect(report.gamesCopied).toBe(1)
  })

  it('replace: the file game takes the place and id of the matched one', () => {
    const other = { ...sampleGame(), id: '11111111-1111-4111-8111-111111111112', name: 'Dota 2' }
    const data = { ...sampleData(), games: [sampleGame(), other] }
    const incoming = { ...sameGameOtherIds(), name: 'pubg', actions: [] }
    const file = fileOf([
      { ...incoming, profiles: [{ ...at(incoming.profiles, 0), bindings: [] }] },
    ])
    const { data: next, report } = run(data, file, {
      [incoming.id]: { strategy: 'replace', profiles: {} },
    })
    expect(next.games.map((g) => g.name)).toEqual(['pubg', 'Dota 2'])
    expect(game0(next).id).toBe(sampleGame().id)
    expect(game0(next).actions).toEqual([])
    expect(report.gamesReplaced).toBe(1)
  })
})

describe('merge of dictionaries', () => {
  it('matches by id: existing values stay, missing items are appended', () => {
    const incoming = sampleGame()
    const run1 = run(
      sampleData(),
      fileOf([
        {
          ...incoming,
          name: 'PUBG (renamed)',
          contexts: [
            ...incoming.contexts,
            {
              id: 'bbbbbbbb-0000-4000-8000-000000000001',
              name: 'Транспорт',
              isGlobal: false,
              order: 2,
            },
          ],
          categories: [
            { ...at(incoming.categories, 0), color: '#000000' },
            { id: 'bbbbbbbb-0000-4000-8000-000000000002', name: 'Бой', color: '#FF0000' },
          ],
          actions: [
            { ...at(incoming.actions, 0), name: 'Прыжок (новое имя)' },
            {
              id: 'bbbbbbbb-0000-4000-8000-000000000003',
              name: 'Газ',
              contextId: 'bbbbbbbb-0000-4000-8000-000000000001',
              categoryId: 'bbbbbbbb-0000-4000-8000-000000000002',
              order: 1,
            },
          ],
        },
      ]),
    )
    const game = game0(run1.data)
    expect(game.name).toBe('PUBG')
    expect(at(game.categories, 0).color).toBe('#3B82F6')
    expect(at(game.actions, 0).name).toBe('Прыжок')
    expect(game.contexts.map((c) => c.name)).toEqual(['Везде', 'Пешком', 'Транспорт'])
    expect(at(game.actions, 1)).toMatchObject({
      id: 'bbbbbbbb-0000-4000-8000-000000000003',
      contextId: 'bbbbbbbb-0000-4000-8000-000000000001',
      categoryId: 'bbbbbbbb-0000-4000-8000-000000000002',
    })
    expect(run1.report).toMatchObject({ gamesMerged: 1, actionsAdded: 1, profilesMerged: 1 })
  })

  it('matches by name when ids differ and points bindings to existing actions', () => {
    const incoming = sameGameOtherIds({ ...sampleGame(), name: 'pubg' })
    const profile = at(incoming.profiles, 0)
    const file = fileOf([
      {
        ...incoming,
        profiles: [
          {
            ...profile,
            bindings: [
              {
                ...at(profile.bindings, 0),
                input: { device: 'keyboard', code: 'KeyJ', modifiers: [] },
              },
            ],
          },
        ],
      },
    ])
    const { data, report } = run(sampleData(), file)
    expect(game0(data).actions).toHaveLength(1)
    const bindings = profile0(data).bindings
    expect(bindings.map((b) => [b.actionId, b.input.code, b.slot])).toEqual([
      [JUMP, 'Space', 1],
      [JUMP, 'KeyJ', 2],
    ])
    expect(report).toMatchObject({ actionsAdded: 0, bindingsAdded: 1, bindingsSkipped: 0 })
  })

  it('adds a missing bind parameter and its options, maps matched ones by name', () => {
    const withParam: Game = {
      ...sampleGame(),
      bindParam: {
        name: 'Режим каста',
        options: [{ id: 'cccccccc-0000-4000-8000-000000000001', name: 'Обычный' }],
      },
    }
    const data = { ...sampleData(), games: [withParam] }
    const incoming = sameGameOtherIds({
      ...withParam,
      bindParam: {
        name: 'Режим каста',
        options: [
          { id: 'dddddddd-0000-4000-8000-000000000001', name: 'обычный' },
          { id: 'dddddddd-0000-4000-8000-000000000002', name: 'Быстрый' },
        ],
      },
    })
    const p = at(incoming.profiles, 0)
    const fileGame = {
      ...incoming,
      profiles: [
        {
          ...p,
          bindings: [
            {
              ...at(p.bindings, 0),
              input: { device: 'keyboard' as const, code: 'KeyJ', modifiers: [] },
              paramOptionId: at(incoming.bindParam?.options ?? [], 0).id,
            },
          ],
        },
      ],
    }
    const { data: next } = run(data, fileOf([fileGame]))
    expect(game0(next).bindParam?.options.map((o) => o.name)).toEqual(['Обычный', 'Быстрый'])
    expect(at(profile0(next).bindings, 1).paramOptionId).toBe(
      'cccccccc-0000-4000-8000-000000000001',
    )
  })
})

describe('merge of profiles', () => {
  function withOneKey(game: Game): Game {
    return { ...game, rules: { ...game.rules, maxKeysPerAction: 1 } }
  }

  it('skips a binding whose slot is taken and does not count duplicates', () => {
    const data = { ...sampleData(), games: [withOneKey(sampleGame())] }
    const incoming = withOneKey(sampleGame())
    const p = at(incoming.profiles, 0)
    const other = { ...at(p.bindings, 0), id: 'eeeeeeee-0000-4000-8000-000000000001' }
    const file = fileOf([
      {
        ...incoming,
        profiles: [
          {
            ...p,
            bindings: [
              at(p.bindings, 0),
              { ...other, input: { device: 'keyboard', code: 'KeyJ', modifiers: [] } },
            ],
          },
        ],
      },
    ])
    const { data: next, report } = run(data, file)
    expect(profile0(next).bindings).toHaveLength(1)
    expect(report).toMatchObject({ bindingsAdded: 0, bindingsSkipped: 1 })
  })

  it('keeps own setting values, adds missing ones and maps select options by name', () => {
    const select: SettingDef = {
      id: 'ffffffff-0000-4000-8000-000000000001',
      group: 'Графика',
      name: 'Качество',
      type: 'select',
      options: [
        { id: 'ffffffff-0000-4000-8000-000000000002', name: 'Низкое' },
        { id: 'ffffffff-0000-4000-8000-000000000003', name: 'Высокое' },
      ],
      defaultValue: 'ffffffff-0000-4000-8000-000000000002',
      order: 1,
    }
    const base = { ...sampleGame(), settingsTemplate: [...sampleGame().settingsTemplate, select] }
    const data = { ...sampleData(), games: [base] }
    const incoming = sameGameOtherIds(base)
    const sel = at(incoming.settingsTemplate, 1)
    if (sel.type !== 'select') throw new Error('select expected')
    const p = at(incoming.profiles, 0)
    const sens = at(incoming.settingsTemplate, 0).id
    const file = fileOf([
      {
        ...incoming,
        profiles: [{ ...p, settingValues: { [sens]: 99, [sel.id]: at(sel.options, 1).id } }],
      },
    ])
    const { data: next } = run(data, file)
    expect(profile0(next).settingValues).toEqual({
      [SENS]: 42,
      [select.id]: 'ffffffff-0000-4000-8000-000000000003',
    })
  })

  it('adds key groups: same name gets new keys, keys in groups are skipped', () => {
    const own: Profile = {
      ...at(sampleGame().profiles, 0),
      keyGroups: [
        {
          id: '12121212-0000-4000-8000-000000000001',
          name: 'Движение',
          color: '#00FF00',
          inputs: ['KeyW'],
        },
      ],
    }
    const data = { ...sampleData(), games: [{ ...sampleGame(), profiles: [own] }] }
    const incoming: Profile = {
      ...own,
      keyGroups: [
        {
          id: '34343434-0000-4000-8000-000000000001',
          name: 'движение',
          color: '#0000FF',
          inputs: ['KeyW', 'KeyA'],
        },
        {
          id: '34343434-0000-4000-8000-000000000002',
          name: 'Бой',
          color: '#FF0000',
          inputs: ['KeyA', 'KeyR'],
        },
        {
          id: '34343434-0000-4000-8000-000000000003',
          name: 'Пустая',
          color: '#FF0000',
          inputs: ['KeyW'],
        },
      ],
    }
    const { data: next } = run(data, fileOf([{ ...sampleGame(), profiles: [incoming] }]))
    expect(profile0(next).keyGroups.map((g) => [g.name, g.color, g.inputs])).toEqual([
      ['Движение', '#00FF00', ['KeyW', 'KeyA']],
      ['Бой', '#FF0000', ['KeyR']],
    ])
  })

  it('copy and replace of a matched profile; an unmatched profile is added', () => {
    const incoming = sampleGame()
    const p = at(incoming.profiles, 0)
    const extra = { ...p, id: '56565656-0000-4000-8000-000000000001', name: 'Тестовый' }
    const file = fileOf([{ ...incoming, profiles: [{ ...p, notes: 'из файла' }, extra] }])

    const copied = run(sampleData(), file, {
      [incoming.id]: { strategy: 'merge', profiles: { [MAIN]: 'copy' } },
    })
    expect(game0(copied.data).profiles.map((x) => x.name)).toEqual([
      'Основной',
      'Основной (2)',
      'Тестовый',
    ])
    expect(copied.report.profilesAdded).toBe(2)

    const replaced = run(sampleData(), file, {
      [incoming.id]: { strategy: 'merge', profiles: { [MAIN]: 'replace' } },
    })
    expect(profile0(replaced.data)).toMatchObject({ id: MAIN, notes: 'из файла' })
    expect(replaced.report).toMatchObject({ profilesReplaced: 1, profilesAdded: 1 })

    const merged = run(sampleData(), file)
    expect(profile0(merged.data).notes).toBe('')
  })
})

describe('previewImport', () => {
  it('shows what matches and what is new', () => {
    const incoming = sameGameOtherIds()
    const extraAction = {
      ...at(incoming.actions, 0),
      id: '78787878-0000-4000-8000-000000000001',
      name: 'Присесть',
    }
    const dota = {
      ...sameGameOtherIds(),
      id: 'abababab-0000-4000-8000-000000000001',
      name: 'Dota 2',
    }
    const extraProfile = {
      ...at(incoming.profiles, 0),
      id: '78787878-0000-4000-8000-000000000002',
      name: 'Новый',
    }
    const file = fileOf(
      [
        {
          ...incoming,
          actions: [...incoming.actions, extraAction],
          profiles: [...incoming.profiles, extraProfile],
        },
        dota,
      ],
      'all',
    )
    const preview = previewImport(sampleData(), file)
    expect(preview.games).toEqual([
      {
        id: incoming.id,
        name: 'PUBG',
        match: { id: sampleGame().id, name: 'PUBG' },
        actionsNew: 1,
        actionsMatched: 1,
        profiles: [
          {
            id: at(incoming.profiles, 0).id,
            name: 'Основной',
            match: { id: MAIN, name: 'Основной' },
          },
          { id: extraProfile.id, name: 'Новый', match: null },
        ],
      },
      {
        id: dota.id,
        name: 'Dota 2',
        match: null,
        actionsNew: 1,
        actionsMatched: 0,
        profiles: [{ id: at(dota.profiles, 0).id, name: 'Основной', match: null }],
      },
    ])
  })

  it('one existing game matches only one file game', () => {
    const byId = sampleGame()
    const byName = sameGameOtherIds()
    const preview = previewImport(sampleData(), fileOf([byName, byId], 'all'))
    expect(preview.games.map((g) => g.match?.id ?? null)).toEqual([null, byId.id])
    const { data } = run(sampleData(), fileOf([byName, byId], 'all'))
    expect(data.games.map((g) => g.name)).toEqual(['PUBG', 'PUBG (2)'])
  })
})

describe('current game after import', () => {
  it('the first added game becomes current; a merge keeps the current game', () => {
    const dota = { ...sameGameOtherIds(), name: 'Dota 2' }
    const added = run(sampleData(), fileOf([dota]))
    expect(added.data.appSettings).toMatchObject({
      lastGameId: dota.id,
      lastProfileId: at(dota.profiles, 0).id,
    })
    const data = {
      ...sampleData(),
      appSettings: { ...sampleData().appSettings, lastGameId: sampleGame().id },
    }
    const merged = run(data, fileOf([sampleGame()]))
    expect(merged.data.appSettings.lastGameId).toBe(sampleGame().id)
  })
})
