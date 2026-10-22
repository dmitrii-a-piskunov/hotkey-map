/**
 * Непередаваемые клавиши текущей игры (FR-01, FR-05): на них нельзя
 * назначить действие, клик даёт вспышку отказа. Пока игр нет — Fn, Win и
 * регулятор.
 */

import { currentGame } from '@/domain/current'
import { DEFAULT_BLOCKED_KEYS } from '@/domain/schema'
import type { SelectableInput } from '@/domain/selection'
import type { AppData } from '@/domain/types'
import { useDataStore } from '@/features/data/store'
import { selectableInputs } from './devices'

export function blockedKeysOf(data: AppData): readonly string[] {
  return currentGame(data)?.rules.blockedKeys ?? DEFAULT_BLOCKED_KEYS
}

/** Массив из данных: ссылка не меняется, пока не меняются правила игры */
export function useBlockedKeys(): readonly string[] {
  return useDataStore((s) => blockedKeysOf(s.data))
}

/** Название текущей игры для подсказки «Эта клавиша не передаётся в <игра>» */
export function useCurrentGameName(): string | undefined {
  return useDataStore((s) => currentGame(s.data)?.name)
}

let cache: { keys: readonly string[]; inputs: SelectableInput[] } | null = null

/** Выделяемые входы с пометкой blocked по правилам текущей игры (FR-13) */
export function currentSelectableInputs(): SelectableInput[] {
  const keys = blockedKeysOf(useDataStore.getState().data)
  if (cache?.keys !== keys) {
    cache = {
      keys,
      inputs: selectableInputs.map((i) =>
        !i.blocked && keys.includes(i.code) ? { ...i, blocked: true } : i,
      ),
    }
  }
  return cache.inputs
}
