/**
 * Импорт в данные приложения (FR-21): совпадения, предпросмотр и
 * стратегии «объединить», «создать копию», «заменить» для игр и профилей.
 *
 * Совпадение — сначала по id, потом по названию без учёта регистра. При
 * объединении существующее не меняется, недостающее добавляется, а ссылки
 * из файла перенаправляются на совпавшие элементы. Id из файла
 * сохраняются, если свободны: тогда повторный импорт совпадёт по id.
 */

import { bindingInSlot, freeSlot, sameInput } from './bindings'
import type { Clock } from './clock'
import { copyGame } from './games'
import { LIMITS, sameName, uniqueName } from './names'
import { appDataSchema } from './schema'
import type {
  AppData,
  Binding,
  ExportFile,
  Game,
  KeyGroup,
  Profile,
  SettingDef,
  SettingValue,
} from './types'

export type ImportStrategy = 'merge' | 'copy' | 'replace'

export interface ImportChoice {
  strategy: ImportStrategy
  /** По id профиля из файла; нет записи — «объединить» */
  profiles: Readonly<Record<string, ImportStrategy>>
}

/** По id игры из файла; нет записи — «объединить» */
export type ImportChoices = Readonly<Record<string, ImportChoice>>

export interface Match {
  id: string
  name: string
}

export interface ProfilePreview {
  id: string
  name: string
  match: Match | null
}

export interface GamePreview {
  id: string
  name: string
  match: Match | null
  actionsNew: number
  actionsMatched: number
  profiles: ProfilePreview[]
}

export interface ImportPreview {
  games: GamePreview[]
  /** Настройки приложения из файла применятся: в приложении ещё нет игр */
  appSettings: boolean
}

export interface ImportReport {
  gamesAdded: number
  gamesMerged: number
  gamesCopied: number
  gamesReplaced: number
  profilesAdded: number
  profilesMerged: number
  profilesReplaced: number
  actionsAdded: number
  bindingsAdded: number
  /** Нужный слот занят, а свободного нет */
  bindingsSkipped: number
}

export type ImportResult =
  | { kind: 'ok'; data: AppData; report: ImportReport }
  /** Итог не прошёл проверку схемой — данные не меняются */
  | { kind: 'error'; messages: string[] }

/* ---------- Совпадения ---------- */

function findMatch<T extends { id: string }>(
  items: readonly T[],
  item: T,
  byName: (candidate: T) => boolean,
  taken: ReadonlySet<string>,
): T | undefined {
  const free = (c: T) => !taken.has(c.id)
  return items.find((c) => free(c) && c.id === item.id) ?? items.find((c) => free(c) && byName(c))
}

/** Игры файла → существующие игры. Одна существующая игра совпадает не больше одного раза */
export function matchGames(
  existing: readonly Game[],
  incoming: readonly Game[],
): Map<string, Game> {
  const result = new Map<string, Game>()
  const taken = new Set<string>()
  // Сначала все совпадения по id, чтобы название другой игры их не перехватило
  for (const game of incoming) {
    const byId = existing.find((g) => g.id === game.id)
    if (byId) {
      result.set(game.id, byId)
      taken.add(byId.id)
    }
  }
  for (const game of incoming) {
    if (result.has(game.id)) continue
    const byName = existing.find((g) => !taken.has(g.id) && sameName(g.name, game.name))
    if (byName) {
      result.set(game.id, byName)
      taken.add(byName.id)
    }
  }
  return result
}

function matchProfiles(target: Game, incoming: Game): Map<string, Profile> {
  const result = new Map<string, Profile>()
  const taken = new Set<string>()
  for (const profile of incoming.profiles) {
    const m = findMatch(target.profiles, profile, (p) => sameName(p.name, profile.name), taken)
    if (m) {
      result.set(profile.id, m)
      taken.add(m.id)
    }
  }
  return result
}

/* ---------- Справочники ---------- */

/** Id из файла, если он свободен, иначе новый; выданный id занимается */
function keepOrNew(id: string, used: Set<string>, clock: Clock): string {
  let next = id
  while (used.has(next)) next = clock.id()
  used.add(next)
  return next
}

const maxOrder = (items: readonly { order: number }[]) =>
  items.reduce((m, i) => Math.max(m, i.order), -1)

const byOrder = <T extends { order: number }>(items: readonly T[]) =>
  [...items].sort((a, b) => a.order - b.order)

interface Dictionaries {
  /** Существующая игра с добавленными справочниками */
  game: Game
  /** Id контекста, категории, действия, настройки или варианта параметра из файла → в игре */
  ids: Map<string, string>
  /** Варианты списков: «настройка из файла:вариант из файла» → вариант в игре */
  selectOptions: Map<string, string>
  actionsNew: number
  actionsMatched: number
}

function sameSetting(a: SettingDef, b: SettingDef): boolean {
  return a.type === b.type && sameName(a.group, b.group) && sameName(a.name, b.name)
}

/** Объединение справочников: совпавшее остаётся как есть, недостающее добавляется в конец */
function mergeDictionaries(target: Game, incoming: Game, clock: Clock): Dictionaries {
  const ids = new Map<string, string>()
  const selectOptions = new Map<string, string>()

  // Контексты: «Везде» всегда совпадает с «Везде»
  const usedContexts = new Set(target.contexts.map((c) => c.id))
  const contexts = [...target.contexts]
  let order = maxOrder(contexts)
  const takenContexts = new Set<string>()
  for (const c of byOrder(incoming.contexts)) {
    const m = c.isGlobal
      ? target.contexts.find((t) => t.isGlobal)
      : findMatch(
          target.contexts.filter((t) => !t.isGlobal),
          c,
          (t) => sameName(t.name, c.name),
          takenContexts,
        )
    if (m) {
      ids.set(c.id, m.id)
      takenContexts.add(m.id)
      continue
    }
    const id = keepOrNew(c.id, usedContexts, clock)
    ids.set(c.id, id)
    contexts.push({ ...c, id, order: ++order })
  }

  const usedCategories = new Set(target.categories.map((c) => c.id))
  const categories = [...target.categories]
  const takenCategories = new Set<string>()
  for (const c of incoming.categories) {
    const m = findMatch(target.categories, c, (t) => sameName(t.name, c.name), takenCategories)
    if (m) {
      ids.set(c.id, m.id)
      takenCategories.add(m.id)
      continue
    }
    const id = keepOrNew(c.id, usedCategories, clock)
    ids.set(c.id, id)
    categories.push({ ...c, id })
  }

  // Действия: название совпадает только в том же контексте
  const usedActions = new Set(target.actions.map((a) => a.id))
  const actions = [...target.actions]
  order = maxOrder(actions)
  const takenActions = new Set<string>()
  let actionsNew = 0
  let actionsMatched = 0
  for (const a of byOrder(incoming.actions)) {
    const contextId = ids.get(a.contextId) ?? a.contextId
    const m = findMatch(
      target.actions,
      a,
      (t) => t.contextId === contextId && sameName(t.name, a.name),
      takenActions,
    )
    if (m) {
      ids.set(a.id, m.id)
      takenActions.add(m.id)
      actionsMatched++
      continue
    }
    const id = keepOrNew(a.id, usedActions, clock)
    ids.set(a.id, id)
    const categoryId = a.categoryId === undefined ? undefined : ids.get(a.categoryId)
    actions.push({ ...a, id, contextId, categoryId, order: ++order })
    actionsNew++
  }

  // Параметр бинда: своего нет — берётся из файла; есть — добавляются недостающие варианты
  let bindParam = target.bindParam
  if (incoming.bindParam) {
    const options = [...(bindParam?.options ?? [])]
    const used = new Set(options.map((o) => o.id))
    const taken = new Set<string>()
    for (const o of incoming.bindParam.options) {
      const m = findMatch(bindParam?.options ?? [], o, (t) => sameName(t.name, o.name), taken)
      if (m) {
        ids.set(o.id, m.id)
        taken.add(m.id)
        continue
      }
      const id = keepOrNew(o.id, used, clock)
      ids.set(o.id, id)
      options.push({ ...o, id })
    }
    bindParam = { name: bindParam?.name ?? incoming.bindParam.name, options }
  }

  // Шаблон настроек: совпадение — тот же тип, группа и название
  const usedSettings = new Set(target.settingsTemplate.map((s) => s.id))
  const settingsTemplate = [...target.settingsTemplate]
  order = maxOrder(settingsTemplate)
  const takenSettings = new Set<string>()
  for (const s of byOrder(incoming.settingsTemplate)) {
    const m = findMatch(target.settingsTemplate, s, (t) => sameSetting(t, s), takenSettings)
    // По id может найтись настройка другого типа — тогда это не совпадение
    if (m?.type === s.type) {
      ids.set(s.id, m.id)
      takenSettings.add(m.id)
      if (m.type === 'select' && s.type === 'select') {
        const taken = new Set<string>()
        for (const o of s.options) {
          const om = findMatch(m.options, o, (t) => sameName(t.name, o.name), taken)
          if (om) {
            selectOptions.set(`${s.id}:${o.id}`, om.id)
            taken.add(om.id)
          }
        }
      }
      continue
    }
    const id = keepOrNew(s.id, usedSettings, clock)
    ids.set(s.id, id)
    if (s.type === 'select') {
      for (const o of s.options) selectOptions.set(`${s.id}:${o.id}`, o.id)
    }
    settingsTemplate.push({ ...s, id, order: ++order })
  }

  return {
    game: { ...target, contexts, categories, actions, bindParam, settingsTemplate },
    ids,
    selectOptions,
    actionsNew,
    actionsMatched,
  }
}

/** Профиль из файла со ссылками на справочники игры; несопоставимое отбрасывается */
function translateProfile(profile: Profile, incoming: Game, dict: Dictionaries): Profile {
  const selects = new Set(
    incoming.settingsTemplate.filter((s) => s.type === 'select').map((s) => s.id),
  )
  const bindings: Binding[] = []
  for (const b of profile.bindings) {
    const actionId = dict.ids.get(b.actionId)
    if (actionId === undefined) continue
    const paramOptionId = b.paramOptionId === undefined ? undefined : dict.ids.get(b.paramOptionId)
    bindings.push({ ...b, actionId, paramOptionId })
  }
  const settingValues: Record<string, SettingValue> = {}
  for (const [key, value] of Object.entries(profile.settingValues)) {
    const id = dict.ids.get(key)
    if (id === undefined) continue
    if (selects.has(key)) {
      const option =
        typeof value === 'string' ? dict.selectOptions.get(`${key}:${value}`) : undefined
      if (option !== undefined) settingValues[id] = option
    } else {
      settingValues[id] = value
    }
  }
  return { ...profile, bindings, settingValues }
}

/* ---------- Профили ---------- */

interface ProfileCounts {
  bindingsAdded: number
  bindingsSkipped: number
}

/** Объединение профиля: бинды — в свободные слоты, значения и группы — недостающие */
function mergeProfile(
  game: Game,
  target: Profile,
  incoming: Profile,
  clock: Clock,
): [Profile, ProfileCounts] {
  const counts: ProfileCounts = { bindingsAdded: 0, bindingsSkipped: 0 }
  const usedBindings = new Set(target.bindings.map((b) => b.id))
  let profile: Profile = { ...target, bindings: [...target.bindings] }

  for (const b of incoming.bindings) {
    const own = profile.bindings.filter((t) => t.actionId === b.actionId)
    if (own.some((t) => sameInput(t.input, b.input))) continue
    const slotFree =
      b.slot <= game.rules.maxKeysPerAction && !bindingInSlot(profile, b.actionId, b.slot)
    const slot = slotFree ? b.slot : freeSlot(game, profile, b.actionId)
    if (slot === null) {
      counts.bindingsSkipped++
      continue
    }
    profile = {
      ...profile,
      bindings: [...profile.bindings, { ...b, id: keepOrNew(b.id, usedBindings, clock), slot }],
    }
    counts.bindingsAdded++
  }

  const grouped = new Set(target.keyGroups.flatMap((g) => g.inputs))
  const usedGroups = new Set(target.keyGroups.map((g) => g.id))
  const keyGroups: KeyGroup[] = target.keyGroups.map((g) => ({ ...g, inputs: [...g.inputs] }))
  for (const g of incoming.keyGroups) {
    const inputs = g.inputs.filter((code) => !grouped.has(code))
    for (const code of inputs) grouped.add(code)
    const same = keyGroups.find((t) => sameName(t.name, g.name))
    if (same) same.inputs.push(...inputs)
    else if (inputs.length > 0) {
      keyGroups.push({ ...g, id: keepOrNew(g.id, usedGroups, clock), inputs })
    }
  }

  return [
    {
      ...profile,
      settingValues: { ...incoming.settingValues, ...target.settingValues },
      keyGroups,
      updatedAt: clock.now(),
    },
    counts,
  ]
}

/* ---------- Предпросмотр ---------- */

/** Clock для подсчётов: id не попадают в данные */
const countingClock: Clock = (() => {
  let n = 0
  return {
    id: () => `00000000-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}`,
    now: () => new Date(0).toISOString(),
  }
})()

export function previewImport(data: AppData, file: ExportFile): ImportPreview {
  const matches = matchGames(data.games, file.games)
  return {
    appSettings: data.games.length === 0 && file.appSettings !== undefined,
    games: file.games.map((game) => {
      const target = matches.get(game.id)
      if (!target) {
        return {
          id: game.id,
          name: game.name,
          match: null,
          actionsNew: game.actions.length,
          actionsMatched: 0,
          profiles: game.profiles.map((p) => ({ id: p.id, name: p.name, match: null })),
        }
      }
      const dict = mergeDictionaries(target, game, countingClock)
      const profiles = matchProfiles(target, game)
      return {
        id: game.id,
        name: game.name,
        match: { id: target.id, name: target.name },
        actionsNew: dict.actionsNew,
        actionsMatched: dict.actionsMatched,
        profiles: game.profiles.map((p) => {
          const m = profiles.get(p.id)
          return { id: p.id, name: p.name, match: m ? { id: m.id, name: m.name } : null }
        }),
      }
    }),
  }
}

/* ---------- Применение ---------- */

function emptyReport(): ImportReport {
  return {
    gamesAdded: 0,
    gamesMerged: 0,
    gamesCopied: 0,
    gamesReplaced: 0,
    profilesAdded: 0,
    profilesMerged: 0,
    profilesReplaced: 0,
    actionsAdded: 0,
    bindingsAdded: 0,
    bindingsSkipped: 0,
  }
}

function mergeGame(
  target: Game,
  incoming: Game,
  choice: ImportChoice | undefined,
  icon: string | undefined,
  clock: Clock,
  report: ImportReport,
): Game {
  const dict = mergeDictionaries(target, incoming, clock)
  report.actionsAdded += dict.actionsNew
  const matches = matchProfiles(target, incoming)
  let profiles = [...target.profiles]
  const usedProfiles = new Set(profiles.map((p) => p.id))
  const now = clock.now()

  for (const source of incoming.profiles) {
    const translated = translateProfile(source, incoming, dict)
    const match = matches.get(source.id)
    const strategy = choice?.profiles[source.id] ?? 'merge'
    const names = (exceptId?: string) =>
      profiles.filter((p) => p.id !== exceptId).map((p) => p.name)

    if (!match || strategy === 'copy') {
      // Копия получает новый id, новый профиль — id из файла, если он свободен
      const id = keepOrNew(match ? clock.id() : source.id, usedProfiles, clock)
      profiles.push({
        ...translated,
        id,
        name: uniqueName(source.name, names(), LIMITS.profile),
        createdAt: now,
        updatedAt: now,
      })
      report.profilesAdded++
      report.bindingsAdded += translated.bindings.length
    } else if (strategy === 'replace') {
      const replaced: Profile = {
        ...translated,
        id: match.id,
        name: uniqueName(source.name, names(match.id), LIMITS.profile),
        updatedAt: now,
      }
      profiles = profiles.map((p) => (p.id === match.id ? replaced : p))
      report.profilesReplaced++
      report.bindingsAdded += translated.bindings.length
    } else {
      const [merged, counts] = mergeProfile(dict.game, match, translated, clock)
      profiles = profiles.map((p) => (p.id === match.id ? merged : p))
      report.profilesMerged++
      report.bindingsAdded += counts.bindingsAdded
      report.bindingsSkipped += counts.bindingsSkipped
    }
  }

  return { ...dict.game, icon: target.icon ?? icon, profiles, updatedAt: now }
}

const countBindings = (game: Game) => game.profiles.reduce((n, p) => n + p.bindings.length, 0)

/**
 * Импорт файла по выбранным стратегиям. icons — имя иконки в файле → имя
 * записанного файла в icons/; иконки без записи не переносятся. Итог
 * проверяется схемой: при ошибке данные не меняются.
 */
export function applyImport(
  data: AppData,
  file: ExportFile,
  choices: ImportChoices,
  clock: Clock,
  icons: Readonly<Record<string, string>> = {},
): ImportResult {
  const report = emptyReport()
  const matches = matchGames(data.games, file.games)
  const iconOf = (game: Game) => (game.icon === undefined ? undefined : icons[game.icon])
  const usedGames = new Set(data.games.map((g) => g.id))
  let games = [...data.games]
  const names = (exceptId?: string) => games.filter((g) => g.id !== exceptId).map((g) => g.name)
  /** Первая добавленная игра становится текущей, как при обычном добавлении */
  let firstAdded: Game | undefined

  for (const incoming of file.games) {
    const target = matches.get(incoming.id)
    const choice = choices[incoming.id]
    const strategy = choice?.strategy ?? 'merge'

    if (!target) {
      const added: Game = {
        ...incoming,
        id: keepOrNew(incoming.id, usedGames, clock),
        name: uniqueName(incoming.name, names(), LIMITS.game),
        icon: iconOf(incoming),
      }
      games.push(added)
      firstAdded ??= added
      report.gamesAdded++
      report.profilesAdded += incoming.profiles.length
      report.actionsAdded += incoming.actions.length
      report.bindingsAdded += countBindings(incoming)
    } else if (strategy === 'copy') {
      const copy: Game = { ...copyGame(incoming, clock, names()), icon: iconOf(incoming) }
      games.push(copy)
      usedGames.add(copy.id)
      firstAdded ??= copy
      report.gamesCopied++
      report.profilesAdded += incoming.profiles.length
      report.actionsAdded += incoming.actions.length
      report.bindingsAdded += countBindings(incoming)
    } else if (strategy === 'replace') {
      const replaced: Game = {
        ...incoming,
        id: target.id,
        name: uniqueName(incoming.name, names(target.id), LIMITS.game),
        icon: iconOf(incoming),
        updatedAt: clock.now(),
      }
      games = games.map((g) => (g.id === target.id ? replaced : g))
      report.gamesReplaced++
      report.profilesReplaced += incoming.profiles.length
      report.bindingsAdded += countBindings(incoming)
    } else {
      const merged = mergeGame(target, incoming, choice, iconOf(incoming), clock, report)
      games = games.map((g) => (g.id === target.id ? merged : g))
      report.gamesMerged++
    }
  }

  // В пустое приложение настройки приходят из файла вместе с последней игрой
  const fromFile = data.games.length === 0 ? file.appSettings : undefined
  const appSettings =
    fromFile ??
    (firstAdded
      ? {
          ...data.appSettings,
          lastGameId: firstAdded.id,
          lastProfileId: firstAdded.profiles[0]?.id,
        }
      : data.appSettings)
  const checked = appDataSchema.safeParse({ ...data, games, appSettings })
  if (!checked.success) {
    return {
      kind: 'error',
      messages: checked.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    }
  }
  return { kind: 'ok', data: checked.data, report }
}
