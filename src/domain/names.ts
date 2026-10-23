/**
 * Названия: обязательность, длина и уникальность (FR-05 – FR-11).
 * Уникальность — без учёта регистра и пробелов по краям.
 */

/** Ограничения длины полей (ТЗ, разделы 7.2 и 9.1) */
export const LIMITS = {
  game: 60,
  context: 60,
  category: 60,
  action: 80,
  actionEn: 80,
  description: 300,
  profile: 40,
  keyGroup: 40,
  notes: 1000,
  bindParam: 60,
  option: 80,
  settingGroup: 60,
  setting: 80,
  unit: 20,
  text: 200,
} as const

export type NameError = 'required' | 'tooLong' | 'duplicate'

function nameKey(name: string): string {
  return name.trim().toLocaleLowerCase('ru')
}

export function sameName(a: string, b: string): boolean {
  return nameKey(a) === nameKey(b)
}

export function nameError(
  value: string,
  max: number,
  taken: readonly string[] = [],
): NameError | null {
  const name = value.trim()
  if (name === '') return 'required'
  if (name.length > max) return 'tooLong'
  if (taken.some((t) => sameName(t, name))) return 'duplicate'
  return null
}

/** Длина необязательного поля: пустое — без ошибки */
export function lengthError(value: string, max: number): 'tooLong' | null {
  return value.trim().length > max ? 'tooLong' : null
}

/**
 * Свободное название: base, а если занято — «base (2)», «base (3)»…
 * Основа обрезается, чтобы результат уложился в max символов.
 */
export function uniqueName(base: string, taken: readonly string[], max: number): string {
  const fit = (s: string, suffix: string) => `${s.slice(0, max - suffix.length).trimEnd()}${suffix}`
  const first = fit(base.trim(), '')
  if (!taken.some((t) => sameName(t, first))) return first
  for (let n = 2; ; n++) {
    const candidate = fit(base.trim(), ` (${n})`)
    if (!taken.some((t) => sameName(t, candidate))) return candidate
  }
}

/** Пустая строка после обрезки пробелов — поле не задано */
export function optionalText(value: string | undefined): string | undefined {
  const text = value?.trim() ?? ''
  return text === '' ? undefined : text
}
