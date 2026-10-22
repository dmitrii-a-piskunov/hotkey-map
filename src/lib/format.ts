/** Форматы из раздела 8.6 ТЗ: дата ДД.ММ.ГГГГ, время ЧЧ:ММ */

const pad = (n: number) => String(n).padStart(2, '0')

export function formatDateTime(d: Date): string {
  const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
  return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Подстановка {name} в строки из ru.ts */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key]
    return value === undefined ? match : String(value)
  })
}

/** Число из поля ввода: запятая или точка как разделитель (раздел 8.6); null — не число */
export function parseDecimal(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (t === '' || !/^-?\d*\.?\d+$|^-?\d+\.$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Число для показа: десятичный разделитель — запятая */
export function formatDecimal(n: number): string {
  return String(n).replace('.', ',')
}
