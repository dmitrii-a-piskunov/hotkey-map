/**
 * Значения настроек профиля (FR-18). Заданное значение хранится, даже если
 * совпадает со значением по умолчанию: смена умолчания в шаблоне его не
 * тронет. Сброс удаляет значение — профиль снова следует за шаблоном.
 */

import { updateProfile } from './profiles'
import { coerceSettingValue, snapToSlider, type ValueSettingDef } from './settings-template'
import type { Game, Profile, SettingDef, SettingValue } from './types'

/** Значение настройки в профиле: своё или по умолчанию */
export function settingValueOf(def: ValueSettingDef, profile: Profile): SettingValue {
  const own = profile.settingValues[def.id]
  if (own === undefined) return def.defaultValue
  return coerceSettingValue(def, own) ?? def.defaultValue
}

export function isDefaultValue(def: ValueSettingDef, profile: Profile): boolean {
  return settingValueOf(def, profile) === def.defaultValue
}

export interface SliderFit {
  value: number
  /** Число было вне диапазона и приведено к границе — подсказка «Допустимо от … до …» */
  clamped: boolean
}

/** Число из поля ползунка: к границам и шагу (FR-18, TC-08) */
export function fitSliderValue(
  def: Extract<SettingDef, { type: 'slider' }>,
  value: number,
): SliderFit {
  return { value: snapToSlider(value, def), clamped: value < def.min || value > def.max }
}

/** Новое значение; неподходящее значение не меняет профиль */
export function setSettingValue(
  game: Game,
  profileId: string,
  settingId: string,
  value: SettingValue,
  now: string,
): Game {
  const def = game.settingsTemplate.find((d) => d.id === settingId)
  if (!def) return game
  const coerced = coerceSettingValue(def, value)
  if (coerced === undefined) return game
  return updateProfile(game, profileId, now, (p) => {
    if (p.settingValues[settingId] === coerced) return p
    return { ...p, settingValues: { ...p.settingValues, [settingId]: coerced } }
  })
}

export function resetSettingValue(
  game: Game,
  profileId: string,
  settingId: string,
  now: string,
): Game {
  return updateProfile(game, profileId, now, (p) => {
    if (!(settingId in p.settingValues)) return p
    const rest = Object.fromEntries(
      Object.entries(p.settingValues).filter(([k]) => k !== settingId),
    )
    return { ...p, settingValues: rest }
  })
}
