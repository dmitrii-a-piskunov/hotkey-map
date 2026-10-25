/**
 * Раскладка раздела как в меню игры: подразделы и две колонки. Порядок
 * внутри колонки — порядок элементов. Если колонки не заданы, подраздел
 * делится пополам: левая колонка получает лишний элемент.
 */

export interface LayoutItem {
  column?: 1 | 2
  subgroup?: string
}

export interface LayoutBlock<T> {
  /** null — без подраздела */
  subgroup: string | null
  left: T[]
  right: T[]
}

export function columnLayout<T extends LayoutItem>(items: readonly T[]): LayoutBlock<T>[] {
  const blocks: { subgroup: string | null; items: T[] }[] = []
  for (const item of items) {
    const key = item.subgroup ?? null
    const block = blocks.find((b) => b.subgroup === key)
    if (block) block.items.push(item)
    else blocks.push({ subgroup: key, items: [item] })
  }
  return blocks.map(({ subgroup, items: list }) => {
    if (!list.some((i) => i.column !== undefined)) {
      const half = Math.ceil(list.length / 2)
      return { subgroup, left: list.slice(0, half), right: list.slice(half) }
    }
    return {
      subgroup,
      left: list.filter((i) => i.column !== 2),
      right: list.filter((i) => i.column === 2),
    }
  })
}

/** В одну колонку: сначала левая, потом правая — как читается меню игры */
export function singleColumn<T>(block: LayoutBlock<T>): T[] {
  return [...block.left, ...block.right]
}
