import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Field } from '@/components/common/field'
import { invalidProps, nameErrorText } from '@/components/common/field-errors'
import { SortableList, SortableRow } from '@/components/common/sortable'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { categoryNameError, categoryUsage, isHexColor, nextColor } from '@/domain/categories'
import { LIMITS } from '@/domain/names'
import type { Category, Game } from '@/domain/types'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'
import {
  addCategoryCmd,
  removeCategoryCmd,
  reorderCategoriesCmd,
  updateCategoryCmd,
} from '../commands'
import { ColorField } from './color-field'

const t = ru.editor.categories

/** Новая категория или правка названия и цвета */
function CategoryDialog({
  game,
  category,
  onClose,
}: {
  game: Game
  category: Category | null
  onClose: () => void
}) {
  const [name, setName] = useState(category?.name ?? '')
  const [color, setColor] = useState(category?.color ?? nextColor(game))
  const [touched, setTouched] = useState(category !== null)
  const error = categoryNameError(game, name, category?.id)
  const shown = touched ? nameErrorText(error, LIMITS.category) : null
  const invalid = error !== null || !isHexColor(color)

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent closeLabel={ru.common.close}>
        <DialogHeader>
          <DialogTitle>{category ? category.name : t.newName}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setTouched(true)
            if (invalid) return
            if (category) updateCategoryCmd(game.id, category.id, { name, color })
            else addCategoryCmd(game.id, { name, color })
            onClose()
          }}
        >
          <Field label={ru.games.name} htmlFor="category-name" error={shown}>
            <Input
              id="category-name"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setTouched(true)
              }}
              {...invalidProps('category-name', shown)}
            />
          </Field>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">{t.color}</span>
            <ColorField id="category-color" value={color} onChange={setColor} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {ru.common.cancel}
            </Button>
            <Button type="submit" disabled={touched && invalid}>
              {category ? ru.common.save : ru.common.add}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Вкладка «Категории» (FR-07): порядок — порядок разделов в списке действий */
export function CategoriesTab({ game }: { game: Game }) {
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  return (
    <div className="grid max-w-2xl gap-4">
      <p className="text-sm text-muted-foreground">{t.hint}</p>
      <SortableList
        items={game.categories}
        onReorder={(ids) => {
          reorderCategoriesCmd(game.id, ids)
        }}
        renderItem={(c) => (
          <SortableRow key={c.id} id={c.id}>
            <span className="size-4 shrink-0 rounded-full" style={{ background: c.color }} />
            <span className="min-w-0 flex-1 truncate text-sm" title={c.name}>
              {c.name}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {fill(t.usage, { count: categoryUsage(game, c.id) })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`${ru.common.edit} ${c.name}`}
              onClick={() => {
                setEditing(c)
              }}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              aria-label={`${ru.common.delete} ${c.name}`}
              onClick={() => {
                setDeleting(c)
              }}
            >
              <Trash2 />
            </Button>
          </SortableRow>
        )}
      />
      <div>
        <Button
          variant="outline"
          onClick={() => {
            setEditing('new')
          }}
        >
          {t.newName}
        </Button>
      </div>
      {editing && (
        <CategoryDialog
          game={game}
          category={editing === 'new' ? null : editing}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          open
          onOpenChange={(o) => {
            if (!o) setDeleting(null)
          }}
          title={fill(t.deleteTitle, { name: deleting.name })}
          description={fill(t.deleteText, { count: categoryUsage(game, deleting.id) })}
          onConfirm={() => {
            removeCategoryCmd(game.id, deleting.id)
            setDeleting(null)
          }}
        />
      )}
    </div>
  )
}
