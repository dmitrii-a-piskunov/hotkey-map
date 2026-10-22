import type { NameError } from '@/domain/names'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'

/** Текст ошибки названия */
export function nameErrorText(
  error: NameError | 'tooLong' | null | undefined,
  max: number,
): string | null {
  switch (error) {
    case 'required':
      return ru.common.required
    case 'tooLong':
      return fill(ru.common.tooLong, { max })
    case 'duplicate':
      return ru.common.duplicate
    default:
      return null
  }
}

/** aria-атрибуты поля с ошибкой */
export function invalidProps(id: string, error: string | null | undefined) {
  return error ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {}
}
