/**
 * Короткая подпись действия на клавише (FR-26): своя из поля short или
 * сокращение названия — «Способность 1» → «СП1», «Изучить левый талант» →
 * «ИЛТ», «Взаимодействие» → «ВЗА». Не длиннее 5 символов.
 */

import { LIMITS } from './names'
import type { Action } from './types'

/** Служебные слова и окончания порядковых числительных («1-я») не дают букв */
const SKIP = new Set([
  'в',
  'во',
  'на',
  'к',
  'ко',
  'с',
  'со',
  'и',
  'по',
  'из',
  'от',
  'для',
  'я',
  'й',
  'е',
  'го',
])

export function abbreviate(name: string): string {
  const tokens = name
    .toLocaleLowerCase('ru')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t !== '')
  const number = tokens.find((t) => /^\d+$/.test(t))
  const words = tokens.filter((t) => /^\p{L}+$/u.test(t) && !SKIP.has(t))
  const first = words[0] ?? tokens[0] ?? ''

  let letters: string
  if (number !== undefined) {
    letters =
      words.length > 1
        ? words
            .slice(0, 2)
            .map((w) => w[0])
            .join('')
        : first.slice(0, 2)
  } else {
    letters =
      words.length > 1
        ? words
            .slice(0, 3)
            .map((w) => w[0])
            .join('')
        : first.slice(0, 3)
  }
  return `${letters.toLocaleUpperCase('ru')}${number ?? ''}`.slice(0, LIMITS.short)
}

export function shortLabelOf(action: Pick<Action, 'name' | 'short'>): string {
  return action.short ?? abbreviate(action.name)
}
