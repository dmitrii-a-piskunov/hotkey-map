/**
 * Схемы Zod для модели данных (ТЗ, раздел 9.1). Типы выводятся из схем,
 * поэтому схема — единственный источник правды о форме data.json.
 *
 * Проверка идёт в два слоя: форма полей и целостность ссылок внутри игры
 * (контекст «Везде», ссылки действий и биндов, группы клавиш). Нарушения
 * правил игры (лишние клавиши у действия, FR-15) — не ошибка данных.
 */

import { z } from 'zod'
import { ru } from '@/i18n/ru'

export const CURRENT_SCHEMA_VERSION = 4

const id = z.uuid()
const isoDate = z.iso.datetime({ offset: true })
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/)
const name = (max: number) => z.string().trim().min(1).max(max)

export const modifierSchema = z.enum(['ctrl', 'shift', 'alt'])
export const MOUSE_CODES = [
  'MouseLeft',
  'MouseRight',
  'MouseMiddle',
  'WheelUp',
  'WheelDown',
  'Mouse4',
  'Mouse5',
] as const
/**
 * Fn и регулятор не передаются ни в одну игру (FR-01, FR-05). Win в части
 * игр назначается, поэтому её добавляют в непередаваемые клавиши игры сами
 */
export const DEFAULT_BLOCKED_KEYS = ['Fn', 'Knob']

const inputCode = z.string().min(1).max(32)

export const rulesSchema = z.object({
  maxKeysPerAction: z.union([z.literal(1), z.literal(2)]),
  allowedModifiers: z.array(modifierSchema),
  blockedKeys: z.array(inputCode).default(() => [...DEFAULT_BLOCKED_KEYS]),
})

export const contextSchema = z.object({
  id,
  name: name(60),
  isGlobal: z.boolean(),
  order: z.int(),
})

/** Колонка в разделе, как в меню игры: 1 — левая, 2 — правая */
const column = z.union([z.literal(1), z.literal(2)]).optional()
/** Подраздел внутри раздела: «Союзники», «Позиции камеры» */
const subgroup = z.string().trim().min(1).max(60).optional()

export const categorySchema = z.object({
  id,
  name: name(60),
  color: hexColor,
  /** Пояснение раздела, как в меню игры */
  note: z.string().max(500).optional(),
  /** slots — ячейки способностей и предметов, как в Dota 2 */
  display: z.enum(['list', 'slots']).optional(),
})

export const actionSchema = z.object({
  id,
  name: name(80),
  nameEn: z.string().trim().max(80).optional(),
  contextId: id,
  categoryId: id.optional(),
  description: z.string().max(300).optional(),
  /** Короткая подпись на клавише (FR-26), например «СП1» */
  short: z.string().trim().min(1).max(5).optional(),
  column,
  subgroup,
  order: z.int(),
})

const optionSchema = z.object({ id, name: name(80) })

export const bindParamSchema = z.object({
  name: name(60),
  options: z.array(optionSchema).min(1),
})

const settingBase = {
  id,
  group: name(60),
  name: name(80),
  unit: z.string().max(20).optional(),
  column,
  subgroup,
  order: z.int(),
}

export const settingDefSchema = z.discriminatedUnion('type', [
  z.object({
    ...settingBase,
    type: z.literal('slider'),
    min: z.number(),
    max: z.number(),
    step: z.number().positive(),
    defaultValue: z.number(),
  }),
  z.object({ ...settingBase, type: z.literal('toggle'), defaultValue: z.boolean() }),
  z.object({
    ...settingBase,
    type: z.literal('select'),
    options: z.array(optionSchema).min(1),
    /** id варианта из options */
    defaultValue: id,
    /** Выпадающий список или кружки, как в меню игры */
    display: z.enum(['list', 'radio']).optional(),
  }),
  z.object({ ...settingBase, type: z.literal('text'), defaultValue: z.string().max(200) }),
  /**
   * Пояснение без значения: текст в рамке на месте картинки из меню игры
   * (схема мини-карты, полосы здоровья). Высота — в строках текста
   */
  z.object({
    ...settingBase,
    type: z.literal('info'),
    text: z.string().max(500),
    height: z.int().min(1).max(20).optional(),
  }),
])

export const settingValueSchema = z.union([z.number(), z.boolean(), z.string().max(200)])

export const inputSchema = z.discriminatedUnion('device', [
  z.object({
    device: z.literal('keyboard'),
    code: inputCode,
    modifiers: z.array(modifierSchema),
  }),
  z.object({
    device: z.literal('mouse'),
    code: z.enum(MOUSE_CODES),
    modifiers: z.array(modifierSchema),
  }),
])

export const pressTypeSchema = z.enum(['press', 'hold', 'toggle', 'double', 'long'])

export const bindingSchema = z.object({
  id,
  actionId: id,
  input: inputSchema,
  pressType: pressTypeSchema,
  paramOptionId: id.optional(),
  slot: z.union([z.literal(1), z.literal(2)]),
})

export const keyGroupSchema = z.object({
  id,
  name: name(40),
  color: hexColor,
  inputs: z.array(inputCode),
})

export const profileSchema = z.object({
  id,
  name: name(40),
  notes: z.string().max(1000),
  bindings: z.array(bindingSchema),
  settingValues: z.record(z.string(), settingValueSchema),
  keyGroups: z.array(keyGroupSchema).default([]),
  createdAt: isoDate,
  updatedAt: isoDate,
})

const gameShape = z.object({
  id,
  name: name(60),
  icon: z.string().max(120).optional(),
  steamAppId: z.int().positive().optional(),
  rules: rulesSchema,
  contexts: z.array(contextSchema),
  categories: z.array(categorySchema),
  actions: z.array(actionSchema),
  bindParam: bindParamSchema.optional(),
  settingsTemplate: z.array(settingDefSchema),
  profiles: z.array(profileSchema).min(1),
  createdAt: isoDate,
  updatedAt: isoDate,
})

type GameShape = z.infer<typeof gameShape>

/** Повторы id в списке: каждый следующий дубликат даёт ошибку */
function checkUniqueIds(
  ctx: z.RefinementCtx,
  items: readonly { id: string }[],
  path: (string | number)[],
): Set<string> {
  const seen = new Set<string>()
  items.forEach((item, i) => {
    if (seen.has(item.id)) {
      ctx.addIssue({ code: 'custom', message: ru.dataErrors.duplicateId, path: [...path, i, 'id'] })
    }
    seen.add(item.id)
  })
  return seen
}

function checkGame(game: GameShape, ctx: z.RefinementCtx): void {
  const globals = game.contexts.filter((c) => c.isGlobal).length
  if (globals !== 1) {
    ctx.addIssue({ code: 'custom', message: ru.dataErrors.globalContext, path: ['contexts'] })
  }

  const contextIds = checkUniqueIds(ctx, game.contexts, ['contexts'])
  const categoryIds = checkUniqueIds(ctx, game.categories, ['categories'])
  const actionIds = checkUniqueIds(ctx, game.actions, ['actions'])
  checkUniqueIds(ctx, game.settingsTemplate, ['settingsTemplate'])
  checkUniqueIds(ctx, game.profiles, ['profiles'])
  const paramIds = new Set(game.bindParam?.options.map((o) => o.id) ?? [])

  game.actions.forEach((a, i) => {
    if (!contextIds.has(a.contextId)) {
      ctx.addIssue({
        code: 'custom',
        message: ru.dataErrors.unknownContext,
        path: ['actions', i, 'contextId'],
      })
    }
    if (a.categoryId !== undefined && !categoryIds.has(a.categoryId)) {
      ctx.addIssue({
        code: 'custom',
        message: ru.dataErrors.unknownCategory,
        path: ['actions', i, 'categoryId'],
      })
    }
  })

  game.settingsTemplate.forEach((s, i) => {
    if (s.type === 'select' && !s.options.some((o) => o.id === s.defaultValue)) {
      ctx.addIssue({
        code: 'custom',
        message: ru.dataErrors.unknownOption,
        path: ['settingsTemplate', i, 'defaultValue'],
      })
    }
  })

  game.profiles.forEach((p, pi) => {
    const profilePath = ['profiles', pi]
    checkUniqueIds(ctx, p.bindings, [...profilePath, 'bindings'])
    checkUniqueIds(ctx, p.keyGroups, [...profilePath, 'keyGroups'])

    p.bindings.forEach((b, bi) => {
      const path = [...profilePath, 'bindings', bi]
      if (!actionIds.has(b.actionId)) {
        ctx.addIssue({
          code: 'custom',
          message: ru.dataErrors.unknownAction,
          path: [...path, 'actionId'],
        })
      }
      if (b.paramOptionId !== undefined && !paramIds.has(b.paramOptionId)) {
        ctx.addIssue({
          code: 'custom',
          message: ru.dataErrors.unknownOption,
          path: [...path, 'paramOptionId'],
        })
      }
    })

    // FR-29: вход — не больше чем в одной группе профиля
    const grouped = new Set<string>()
    p.keyGroups.forEach((g, gi) => {
      g.inputs.forEach((code, ci) => {
        if (grouped.has(code)) {
          ctx.addIssue({
            code: 'custom',
            message: ru.dataErrors.inputInTwoGroups,
            path: [...profilePath, 'keyGroups', gi, 'inputs', ci],
          })
        }
        grouped.add(code)
      })
    })
  })
}

export const gameSchema = gameShape.superRefine(checkGame)

function checkGames(games: readonly GameShape[], ctx: z.RefinementCtx): void {
  checkUniqueIds(ctx, games, ['games'])
  const names = new Set<string>()
  games.forEach((g, i) => {
    const key = g.name.toLocaleLowerCase('ru')
    if (names.has(key)) {
      ctx.addIssue({
        code: 'custom',
        message: ru.dataErrors.duplicateGameName,
        path: ['games', i, 'name'],
      })
    }
    names.add(key)
  })
}

export const appSettingsSchema = z.object({
  /** FR-25 */
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  /** FR-04: EN/RU, EN или RU */
  labelLang: z.enum(['enru', 'en', 'ru']).default('enru'),
  /** FR-04: автопереключение EN ↔ RU по последней клавише */
  autoLang: z.boolean().default(true),
  /** FR-01 */
  view: z.enum(['3d', '2d']).default('3d'),
  /** FR-26 */
  showLabels: z.boolean().default(true),
  /** FR-30 */
  colorMode: z.enum(['category', 'group']).default('category'),
  /** FR-03 */
  inputMode: z.enum(['check', 'nav']).default('check'),
  /** Показывать клавиатуру и мышь (шапка): скрытое не мешает настраивать другое */
  showKeyboard: z.boolean().default(true),
  showMouse: z.boolean().default(true),
  /** FR-01: расцветка клавиатуры (шапка) */
  keyboardColor: z.enum(['standard', 'black']).default('standard'),
  lastGameId: id.optional(),
  lastProfileId: id.optional(),
  /** FR-23: дата последнего экспорта, для напоминания в режиме Firefox */
  lastExportAt: isoDate.optional(),
})

export const appDataSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  games: z.array(gameSchema).superRefine(checkGames),
  // prefault, а не default: пустой объект проходит через схему и получает значения полей
  appSettings: appSettingsSchema.prefault({}),
})

/** Иконка внутри файла экспорта: PNG в Base64, как её хранит папка icons/ */
const iconDataUrl = z.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/)

export const exportScopeSchema = z.enum(['all', 'game', 'profile'])

/**
 * Файл экспорта и заготовки (FR-21, FR-22, раздел 9.4). Профиль
 * выгружается вместе со своей игрой и её справочниками: в файле одна игра
 * с одним профилем. Иконки — по имени файла из game.icon.
 */
export const exportFileSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    scope: exportScopeSchema,
    exportedAt: isoDate,
    /** Заготовка из src/presets, а не экспорт пользователя */
    preset: z.boolean().optional(),
    games: z.array(gameSchema).superRefine(checkGames),
    appSettings: appSettingsSchema.optional(),
    icons: z.record(z.string().min(1).max(120), iconDataUrl).optional(),
  })
  .superRefine((file, ctx) => {
    if (file.scope === 'all') return
    if (file.games.length !== 1) {
      ctx.addIssue({ code: 'custom', message: ru.dataErrors.oneGameInFile, path: ['games'] })
    } else if (file.scope === 'profile' && file.games[0]?.profiles.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        message: ru.dataErrors.oneProfileInFile,
        path: ['games', 0, 'profiles'],
      })
    }
  })
