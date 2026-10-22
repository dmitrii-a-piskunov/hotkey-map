/** Перестановки в списках: сортировка перетаскиванием (FR-06 – FR-10) */

/** Переносит элемент с позиции from на позицию to */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items]
  const [item] = result.splice(from, 1)
  if (item === undefined) return result
  result.splice(Math.max(0, Math.min(to, result.length)), 0, item)
  return result
}

/** Расставляет элементы в порядке ids; не упомянутые остаются в конце */
export function orderByIds<T extends { id: string }>(
  items: readonly T[],
  ids: readonly string[],
): T[] {
  const rank = new Map(ids.map((id, i) => [id, i]))
  return items
    .map((item, i) => ({ item, key: rank.get(item.id) ?? ids.length + i }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.item)
}

export function byOrder<T extends { order: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order)
}
