/**
 * Шаблон настроек игры (FR-10): общий для всех профилей, настройки
 * объединены в группы. Изменение настройки приводит значения в профилях к
 * новому виду: число — к диапазону и шагу ползунка; значение, которое не
 * подходит к новому типу или варианту, сбрасывается к значению по умолчанию.
 */

import type { Clock } from './clock'
import { LIMITS, lengthError, nameError, optionalText, type NameError } from './names'
import { byOrder } from './order'
import type { Game, SettingDef, SettingValue } from './types'

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

export type SettingDraft = DistributiveOmit<SettingDef, 'id' | 'order'>
export type SettingType = SettingDef['type']
type SliderRange = Pick<Extract<SettingDef, { type: 'slider' }>, 'min' | 'max' | 'step'>
/** Настройка со значением; info — только пояснение */
export type ValueSettingDef = Exclude<SettingDef, { type: 'info' }>

export function hasValue(def: SettingDef): def is ValueSettingDef {
  return def.type !== 'info'
}

function decimals(n: number): number {
  const text = String(n)
  if (text.includes('e-')) return Number(text.split('e-')[1])
  return text.split('.')[1]?.length ?? 0
}

/** FR-18: значение ползунка — в границах и кратно шагу от минимума */
export function snapToSlider(value: number, range: SliderRange): number {
  const { min, max, step } = range
  const clamped = Math.min(max, Math.max(min, value))
  // toFixed убирает хвосты деления: 0.35 / 0.1 = 3.4999…
  const steps = Math.round(Number(((clamped - min) / step).toFixed(9)))
  const snapped = min + steps * step
  const digits = Math.max(decimals(step), decimals(min))
  const rounded = Number(snapped.toFixed(digits))
  return Math.min(max, Math.max(min, rounded))
}

/** Значение в профиле под настройку; undefined — значение сбрасывается к умолчанию */
export function coerceSettingValue(def: SettingDef, value: SettingValue): SettingValue | undefined {
  switch (def.type) {
    case 'slider':
      return typeof value === 'number' && Number.isFinite(value)
        ? snapToSlider(value, def)
        : undefined
    case 'toggle':
      return typeof value === 'boolean' ? value : undefined
    case 'select':
      return typeof value === 'string' && def.options.some((o) => o.id === value)
        ? value
        : undefined
    case 'text':
      return typeof value === 'string' && value.length <= LIMITS.text ? value : undefined
    case 'info':
      return undefined
  }
}

export interface SettingSection {
  group: string
  settings: SettingDef[]
}

/** Группы в порядке первой настройки группы */
export function settingSections(game: Game): SettingSection[] {
  const sections: SettingSection[] = []
  for (const def of byOrder(game.settingsTemplate)) {
    const section = sections.find((s) => s.group === def.group)
    if (section) section.settings.push(def)
    else sections.push({ group: def.group, settings: [def] })
  }
  return sections
}

function fromSections(game: Game, sections: readonly SettingSection[]): Game {
  let order = 0
  return {
    ...game,
    settingsTemplate: sections.flatMap((s) =>
      s.settings.map((d) => {
        const next = order++
        return d.order === next && d.group === s.group ? d : { ...d, order: next, group: s.group }
      }),
    ),
  }
}

function placeAtEnd(game: Game, def: SettingDef): Game {
  const sections = settingSections({
    ...game,
    settingsTemplate: game.settingsTemplate.filter((d) => d.id !== def.id),
  })
  const section = sections.find((s) => s.group === def.group)
  if (section) section.settings.push(def)
  else sections.push({ group: def.group, settings: [def] })
  return fromSections(game, sections)
}

export interface SettingDraftErrors {
  group?: NameError
  name?: NameError
  unit?: 'tooLong'
  /** Ползунок: минимум не меньше максимума */
  range?: true
  /** Ползунок: шаг не положительный или больше диапазона */
  step?: true
  /** Значение по умолчанию вне диапазона или слишком длинное */
  defaultValue?: true
  /** Список: нет вариантов или пустой/повторяющийся вариант */
  options?: true
  /** Пояснение длиннее 500 символов */
  text?: true
}

export function settingDraftErrors(draft: SettingDraft): SettingDraftErrors {
  const errors: SettingDraftErrors = {}
  const group = nameError(draft.group, LIMITS.settingGroup)
  if (group) errors.group = group
  const name = nameError(draft.name, LIMITS.setting)
  if (name) errors.name = name
  if (lengthError(draft.unit ?? '', LIMITS.unit)) errors.unit = 'tooLong'
  switch (draft.type) {
    case 'slider': {
      const finite = [draft.min, draft.max, draft.step, draft.defaultValue].every(Number.isFinite)
      if (!finite || draft.min >= draft.max) errors.range = true
      if (!finite || draft.step <= 0 || draft.step > draft.max - draft.min) errors.step = true
      if (!finite || draft.defaultValue < draft.min || draft.defaultValue > draft.max) {
        errors.defaultValue = true
      }
      break
    }
    case 'select': {
      const bad = draft.options.some(
        (o, i) =>
          nameError(
            o.name,
            LIMITS.option,
            draft.options.slice(0, i).map((x) => x.name),
          ) !== null,
      )
      if (draft.options.length === 0 || bad) errors.options = true
      if (!draft.options.some((o) => o.id === draft.defaultValue)) errors.defaultValue = true
      break
    }
    case 'text':
      if (draft.defaultValue.length > LIMITS.text) errors.defaultValue = true
      break
    case 'toggle':
      break
    case 'info':
      if (draft.text.length > LIMITS.info) errors.text = true
      break
  }
  return errors
}

function normalizeDraft(draft: SettingDraft): SettingDraft {
  const base = {
    group: draft.group.trim(),
    name: draft.name.trim(),
    unit: optionalText(draft.unit),
  }
  if (draft.type === 'select') {
    return { ...draft, ...base, options: draft.options.map((o) => ({ ...o, name: o.name.trim() })) }
  }
  if (draft.type === 'slider') {
    return { ...draft, ...base, defaultValue: snapToSlider(draft.defaultValue, draft) }
  }
  return { ...draft, ...base }
}

export function addSetting(game: Game, clock: Clock, draft: SettingDraft): Game {
  const def: SettingDef = { ...normalizeDraft(draft), id: clock.id(), order: 0 }
  return placeAtEnd(game, def)
}

/** Профили, в которых значение настройки изменится или сбросится */
export function settingValueImpact(game: Game, def: SettingDef | null, id: string): number {
  return game.profiles.filter((p) => {
    const value = p.settingValues[id]
    if (value === undefined) return false
    if (def === null) return true
    return coerceSettingValue(def, value) !== value
  }).length
}

/** Сколько профилей затронет сохранение черновика (FR-10: предупреждение) */
export function settingUpdateImpact(game: Game, id: string, draft: SettingDraft): number {
  const current = game.settingsTemplate.find((d) => d.id === id)
  if (!current) return 0
  return settingValueImpact(game, { ...normalizeDraft(draft), id, order: current.order }, id)
}

/** Изменился ли диапазон или шаг ползунка */
export function sliderRangeChanged(current: SettingDef, draft: SettingDraft): boolean {
  if (current.type !== 'slider' || draft.type !== 'slider') return false
  return current.min !== draft.min || current.max !== draft.max || current.step !== draft.step
}

function coerceProfiles(game: Game, def: SettingDef | null, id: string): Game['profiles'] {
  return game.profiles.map((p) => {
    const value = p.settingValues[id]
    if (value === undefined) return p
    const next = def === null ? undefined : coerceSettingValue(def, value)
    if (next === value) return p
    const rest = Object.fromEntries(Object.entries(p.settingValues).filter(([k]) => k !== id))
    return { ...p, settingValues: next === undefined ? rest : { ...rest, [id]: next } }
  })
}

/** Правка настройки; значения в профилях приводятся к новому виду */
export function updateSetting(game: Game, id: string, draft: SettingDraft): Game {
  const current = game.settingsTemplate.find((d) => d.id === id)
  if (!current) return game
  const def: SettingDef = { ...normalizeDraft(draft), id, order: current.order }
  const updated =
    def.group === current.group
      ? { ...game, settingsTemplate: game.settingsTemplate.map((d) => (d.id === id ? def : d)) }
      : placeAtEnd(game, def)
  return { ...updated, profiles: coerceProfiles(game, def, id) }
}

/** Удаление настройки: значения удаляются из профилей (раздел 9.2) */
export function removeSetting(game: Game, id: string): Game {
  const rest = { ...game, settingsTemplate: game.settingsTemplate.filter((d) => d.id !== id) }
  return { ...fromSections(rest, settingSections(rest)), profiles: coerceProfiles(game, null, id) }
}

/** Перетаскивание: настройка встаёт на позицию index группы group и переходит в неё */
export function moveSetting(game: Game, id: string, group: string, index: number): Game {
  const def = game.settingsTemplate.find((d) => d.id === id)
  if (!def) return game
  const sections = settingSections({
    ...game,
    settingsTemplate: game.settingsTemplate.filter((d) => d.id !== id),
  })
  let section = sections.find((s) => s.group === group)
  if (!section) {
    section = { group, settings: [] }
    sections.push(section)
  }
  section.settings.splice(Math.max(0, Math.min(index, section.settings.length)), 0, def)
  return fromSections(game, sections)
}

/** Черновик новой настройки нужного типа с разумными значениями */
export function emptySettingDraft(type: SettingType, group: string, clock: Clock): SettingDraft {
  const base = { group, name: '', unit: undefined }
  switch (type) {
    case 'slider':
      return { ...base, type, min: 0, max: 100, step: 1, defaultValue: 50 }
    case 'toggle':
      return { ...base, type, defaultValue: false }
    case 'select': {
      const id = clock.id()
      return { ...base, type, options: [{ id, name: '' }], defaultValue: id }
    }
    case 'text':
      return { ...base, type, defaultValue: '' }
    case 'info':
      return { ...base, type, text: '' }
  }
}
