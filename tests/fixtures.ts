import { createAppData } from '@/domain/app-data'
import type { Clock } from '@/domain/clock'
import type { AppData, Game } from '@/domain/types'

export const T = '2026-10-22T10:00:00.000Z'

/** Элемент массива с проверкой: в тестах вместо `arr[i]!` */
export function at<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) throw new Error(`No item at ${index}`)
  return item
}

/** Игра в духе приложения Б ТЗ: PUBG, два контекста, одно действие, один бинд */
export function sampleGame(): Game {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'PUBG',
    steamAppId: 578080,
    rules: {
      maxKeysPerAction: 2,
      allowedModifiers: ['ctrl', 'shift', 'alt'],
      blockedKeys: ['Fn', 'MetaLeft', 'Knob'],
    },
    contexts: [
      { id: '22222222-2222-4222-8222-222222222220', name: 'Везде', isGlobal: true, order: 0 },
      { id: '22222222-2222-4222-8222-222222222221', name: 'Пешком', isGlobal: false, order: 1 },
    ],
    categories: [
      { id: '33333333-3333-4333-8333-333333333331', name: 'Движение', color: '#3B82F6' },
    ],
    actions: [
      {
        id: '44444444-4444-4444-8444-444444444441',
        name: 'Прыжок',
        nameEn: 'Jump',
        contextId: '22222222-2222-4222-8222-222222222221',
        categoryId: '33333333-3333-4333-8333-333333333331',
        order: 0,
      },
    ],
    settingsTemplate: [
      {
        id: '55555555-5555-4555-8555-555555555551',
        group: 'Мышь',
        name: 'Чувствительность',
        type: 'slider',
        min: 1,
        max: 100,
        step: 1,
        defaultValue: 50,
        order: 0,
      },
    ],
    profiles: [
      {
        id: '66666666-6666-4666-8666-666666666661',
        name: 'Основной',
        notes: '',
        bindings: [
          {
            id: '77777777-7777-4777-8777-777777777771',
            actionId: '44444444-4444-4444-8444-444444444441',
            input: { device: 'keyboard', code: 'Space', modifiers: [] },
            pressType: 'press',
            slot: 1,
          },
        ],
        settingValues: { '55555555-5555-4555-8555-555555555551': 42 },
        keyGroups: [],
        createdAt: T,
        updatedAt: T,
      },
    ],
    createdAt: T,
    updatedAt: T,
  }
}

export function sampleData(): AppData {
  return { ...createAppData(), games: [sampleGame()] }
}

/** Предсказуемые UUID v4 и время: id по порядку выдачи */
export function testClock(now = T): Clock & { issued: () => number } {
  let n = 0
  return {
    id: () => `00000000-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}`,
    now: () => now,
    issued: () => n,
  }
}
