/** Форматы из раздела 8.6 ТЗ: дата ДД.ММ.ГГГГ, время ЧЧ:ММ */

const pad = (n: number) => String(n).padStart(2, '0')

export function formatDateTime(d: Date): string {
  const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
  return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Подстановка {name} в строки из ru.ts */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
}
