/**
 * Сортировка перетаскиванием (FR-06 – FR-10) на dnd-kit: мышью за ручку
 * и с клавиатуры (пробел, стрелки, пробел — раздел 8.5). Работает в
 * Chrome и Firefox одинаково: без HTML5 drag-and-drop.
 */

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ru } from '@/i18n/ru'
import { cn } from '@/lib/utils'

function useListSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}

interface RowProps {
  id: string
  disabled?: boolean
  className?: string
  children: ReactNode
}

/** Строка списка с ручкой слева */
export function SortableRow({ id, disabled = false, className, children }: RowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-md border bg-background px-2 py-1.5',
        isDragging && 'relative z-10 opacity-80 shadow-md',
        className,
      )}
      data-sortable-id={id}
    >
      {disabled ? (
        <span className="w-6 shrink-0" />
      ) : (
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="flex h-7 w-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
          aria-label={ru.common.dragHandle}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      )}
      {children}
    </li>
  )
}

interface ListProps<T extends { id: string }> {
  items: readonly T[]
  onReorder: (ids: string[]) => void
  renderItem: (item: T) => ReactNode
  className?: string
}

/** Один список: новый порядок id отдаётся после отпускания */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  className,
}: ListProps<T>) {
  const sensors = useListSensors()
  const ids = items.map((i) => i.id)
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return
        const from = ids.indexOf(String(active.id))
        const to = ids.indexOf(String(over.id))
        if (from === -1 || to === -1) return
        onReorder(arrayMove(ids, from, to))
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className={cn('grid gap-1.5', className)}>{items.map(renderItem)}</ul>
      </SortableContext>
    </DndContext>
  )
}

export interface SortableSection<T> {
  id: string
  items: readonly T[]
}

interface SectionedProps<T extends { id: string }> {
  sections: readonly SortableSection<T>[]
  /** Элемент встал на позицию index раздела sectionId */
  onMove: (itemId: string, sectionId: string, index: number) => void
  renderSection: (sectionId: string, list: ReactNode, count: number) => ReactNode
  renderItem: (item: T) => ReactNode
  /** Пустой раздел: место, куда можно бросить элемент */
  emptyText: string
  disabled?: boolean
}

const SECTION_PREFIX = 'section:'

function SectionDrop({
  id,
  empty,
  emptyText,
  children,
}: {
  id: string
  empty: boolean
  emptyText: string
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: SECTION_PREFIX + id })
  return (
    <ul
      ref={setNodeRef}
      className={cn('grid min-h-10 gap-1.5 rounded-md', isOver && empty && 'bg-accent')}
    >
      {children}
      {empty && (
        <li className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {emptyText}
        </li>
      )}
    </ul>
  )
}

type Layout = Record<string, string[]>

function layoutOf<T extends { id: string }>(sections: readonly SortableSection<T>[]): Layout {
  return Object.fromEntries(sections.map((s) => [s.id, s.items.map((i) => i.id)]))
}

function findSection(layout: Layout, id: UniqueIdentifier): string | undefined {
  const key = String(id)
  if (key.startsWith(SECTION_PREFIX)) return key.slice(SECTION_PREFIX.length)
  return Object.keys(layout).find((s) => layout[s]?.includes(key))
}

/**
 * Список с разделами: элемент переносится внутри раздела и между ними
 * (FR-08: перенос в другой раздел меняет категорию действия).
 */
export function SectionedSortable<T extends { id: string }>({
  sections,
  onMove,
  renderSection,
  renderItem,
  emptyText,
  disabled = false,
}: SectionedProps<T>) {
  const sensors = useListSensors()
  // Пока элемент тащат, раскладка живёт здесь: он уже «переехал» в другой раздел
  const [dragLayout, setDragLayout] = useState<Layout | null>(null)
  const layout = dragLayout ?? layoutOf(sections)
  const byId = new Map(sections.flatMap((s) => s.items.map((i) => [i.id, i] as const)))

  /**
   * Цель — строка, а не раздел целиком: иначе центр длинного раздела
   * оказывается ближе строк, и перенос теряется. Раздел под указателем
   * выбирается первым; пустой раздел — сам себе цель.
   */
  const collision: CollisionDetection = (args) => {
    const isSection = (id: UniqueIdentifier) => String(id).startsWith(SECTION_PREFIX)
    const items = args.droppableContainers.filter((c) => !isSection(c.id))
    const [hit] = pointerWithin({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => isSection(c.id)),
    })
    if (hit) {
      const ids = layout[String(hit.id).slice(SECTION_PREFIX.length)] ?? []
      const inSection = items.filter((c) => ids.includes(String(c.id)) || c.id === args.active.id)
      if (ids.length === 0) return [hit]
      return closestCenter({ ...args, droppableContainers: inSection })
    }
    return closestCenter({ ...args, droppableContainers: items })
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const from = findSection(layout, active.id)
    const to = findSection(layout, over.id)
    if (!from || !to || from === to) return
    const target = layout[to] ?? []
    const overIndex = target.indexOf(String(over.id))
    // Ниже середины строки — встаём после неё
    const dragged = active.rect.current.translated
    const below = dragged !== null && dragged.top > over.rect.top + over.rect.height / 2
    const index = overIndex === -1 ? target.length : overIndex + (below ? 1 : 0)
    setDragLayout({
      ...layout,
      [from]: (layout[from] ?? []).filter((i) => i !== String(active.id)),
      [to]: [...target.slice(0, index), String(active.id), ...target.slice(index)],
    })
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const current = layout
    setDragLayout(null)
    if (!over) return
    const section = findSection(current, active.id)
    if (!section) return
    const ids = current[section] ?? []
    const from = ids.indexOf(String(active.id))
    const overIndex = ids.indexOf(String(over.id))
    const to = overIndex === -1 ? from : overIndex
    const finalIds = arrayMove(ids, from, to)
    onMove(String(active.id), section, finalIds.indexOf(String(active.id)))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={() => {
        setDragLayout(layoutOf(sections))
      }}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDragLayout(null)
      }}
    >
      {sections.map((s) => {
        const ids = layout[s.id] ?? []
        const list = (
          <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={disabled}>
            <SectionDrop id={s.id} empty={ids.length === 0} emptyText={emptyText}>
              {ids.flatMap((id) => {
                const item = byId.get(id)
                return item ? [renderItem(item)] : []
              })}
            </SectionDrop>
          </SortableContext>
        )
        return <div key={s.id}>{renderSection(s.id, list, ids.length)}</div>
      })}
    </DndContext>
  )
}
