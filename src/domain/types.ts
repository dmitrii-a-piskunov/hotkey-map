/** Типы модели данных (ТЗ, раздел 9.1), выведенные из схем Zod */

import type { z } from 'zod'
import type {
  actionSchema,
  appDataSchema,
  appSettingsSchema,
  bindingSchema,
  bindParamSchema,
  categorySchema,
  contextSchema,
  exportFileSchema,
  gameSchema,
  inputSchema,
  keyGroupSchema,
  modifierSchema,
  pressTypeSchema,
  profileSchema,
  rulesSchema,
  settingDefSchema,
  settingValueSchema,
} from './schema'

export type Modifier = z.infer<typeof modifierSchema>
export type GameRules = z.infer<typeof rulesSchema>
export type Context = z.infer<typeof contextSchema>
export type Category = z.infer<typeof categorySchema>
export type Action = z.infer<typeof actionSchema>
export type BindParam = z.infer<typeof bindParamSchema>
export type SettingDef = z.infer<typeof settingDefSchema>
export type SettingValue = z.infer<typeof settingValueSchema>
export type BindingInput = z.infer<typeof inputSchema>
export type PressType = z.infer<typeof pressTypeSchema>
export type Binding = z.infer<typeof bindingSchema>
export type KeyGroup = z.infer<typeof keyGroupSchema>
export type Profile = z.infer<typeof profileSchema>
export type Game = z.infer<typeof gameSchema>
export type AppSettings = z.infer<typeof appSettingsSchema>
export type AppData = z.infer<typeof appDataSchema>
export type ExportFile = z.infer<typeof exportFileSchema>

export type Theme = AppSettings['theme']
export type ViewMode = AppSettings['view']
export type InputMode = AppSettings['inputMode']
export type ColorMode = AppSettings['colorMode']
