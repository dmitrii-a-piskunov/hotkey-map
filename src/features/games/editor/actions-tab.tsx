import { ListPlus, Pencil, Search, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Field } from '@/components/common/field'
import { invalidProps, nameErrorText } from '@/components/common/field-errors'
import { SectionedSortable, SortableRow } from '@/components/common/sortable'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import {
  actionBindingCount,
  actionDraftErrors,
  actionSections,
  searchSections,
  type ActionDraft,
} from '@/domain/actions'
import { globalContext, sortedContexts } from '@/domain/contexts'
import { LIMITS } from '@/domain/names'
import { bindingsOfAction } from '@/domain/bindings'
import { currentProfile } from '@/domain/current'
import type { Action, Game } from '@/domain/types'
import { comboName } from '@/features/bindings/format'
import { useSettings } from '@/features/data/store'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'
import { addActionCmd, moveActionCmd, removeActionCmd, updateActionCmd } from '../commands'

const t = ru.editor.actions

/** Раздел «Без категории» в перетаскивании */
const NO_CATEGORY = 'no-category'

function ActionDialog({
  game,
  action,
  onClose,
}: {
  game: Game
  action: Action | null
  onClose: () => void
}) {
  const [draft, setDraft] = useState<ActionDraft>(() =>
    action
      ? { ...action }
      : { name: '', nameEn: '', contextId: globalContext(game).id, description: '' },
  )
  const [touched, setTouched] = useState(action !== null)
  const errors = actionDraftErrors(draft)
  const invalid = Object.keys(errors).length > 0
  const show = (text: string | null) => (touched ? text : null)
  const nameError = show(nameErrorText(errors.name, LIMITS.action))
  const nameEnError = show(nameErrorText(errors.nameEn, LIMITS.actionEn))
  const descriptionError = show(nameErrorText(errors.description, LIMITS.description))

  function update(patch: Partial<ActionDraft>) {
    setDraft((d) => ({ ...d, ...patch }))
    setTouched(true)
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent closeLabel={ru.common.close}>
        <DialogHeader>
          <DialogTitle>{action ? t.editTitle : t.newTitle}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setTouched(true)
            if (invalid) return
            if (action) updateActionCmd(game.id, action.id, draft)
            else addActionCmd(game.id, draft)
            onClose()
          }}
        >
          <Field label={t.name} htmlFor="action-name" error={nameError}>
            <Input
              id="action-name"
              autoFocus
              value={draft.name}
              onChange={(e) => {
                update({ name: e.target.value })
              }}
              {...invalidProps('action-name', nameError)}
            />
          </Field>
          <Field label={t.nameEn} htmlFor="action-name-en" error={nameEnError}>
            <Input
              id="action-name-en"
              value={draft.nameEn ?? ''}
              onChange={(e) => {
                update({ nameEn: e.target.value })
              }}
              {...invalidProps('action-name-en', nameEnError)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t.context} htmlFor="action-context">
              <NativeSelect
                id="action-context"
                value={draft.contextId}
                onChange={(e) => {
                  update({ contextId: e.target.value })
                }}
              >
                {sortedContexts(game).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t.category} htmlFor="action-category">
              <NativeSelect
                id="action-category"
                value={draft.categoryId ?? ''}
                onChange={(e) => {
                  update({ categoryId: e.target.value === '' ? undefined : e.target.value })
                }}
              >
                <option value="">{t.noCategory}</option>
                {game.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label={t.description} htmlFor="action-description" error={descriptionError}>
            <Textarea
              id="action-description"
              rows={3}
              value={draft.description ?? ''}
              onChange={(e) => {
                update({ description: e.target.value })
              }}
              {...invalidProps('action-description', descriptionError)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {ru.common.cancel}
            </Button>
            <Button type="submit" disabled={touched && invalid}>
              {action ? ru.common.save : ru.common.add}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Вкладка «Действия» (FR-08): разделы по категориям, перетаскивание, поиск (FR-16) */
export function ActionsTab({ game }: { game: Game }) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Action | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Action | null>(null)
  const searching = query.trim() !== ''
  const contexts = new Map(game.contexts.map((c) => [c.id, c.name]))
  const colors = new Map(game.categories.map((c) => [c.id, c.color]))
  // Клавиши текущего профиля — для справки: назначают их в панели справа (FR-12)
  const settings = useSettings((s) => s)
  const profile = currentProfile(game, settings)

  const row = (a: Action): ReactNode => (
    <SortableRow key={a.id} id={a.id} disabled={searching}>
      <span
        className="size-2.5 shrink-0 rounded-full bg-muted-foreground/40"
        style={a.categoryId ? { background: colors.get(a.categoryId) } : undefined}
        aria-hidden="true"
      />
      <div className="grid min-w-0 flex-1">
        <span className="truncate text-sm" title={a.name}>
          {a.name}
        </span>
        {a.nameEn && (
          <span className="truncate text-xs text-muted-foreground" title={a.nameEn}>
            {a.nameEn}
          </span>
        )}
      </div>
      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
        {contexts.get(a.contextId)}
      </span>
      <span
        data-slot="action-keys"
        className="w-24 shrink-0 truncate text-right text-xs text-muted-foreground"
        title={t.keysHint}
      >
        {profile
          ? bindingsOfAction(profile, a.id)
              .map((b) => comboName(b.input))
              .join(', ') || ru.bindings.notAssigned
          : null}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={`${ru.common.edit} ${a.name}`}
        onClick={() => {
          setEditing(a)
        }}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-destructive"
        aria-label={`${ru.common.delete} ${a.name}`}
        onClick={() => {
          setDeleting(a)
        }}
      >
        <Trash2 />
      </Button>
    </SortableRow>
  )

  const heading = (title: string, color: string | undefined, count: number) => (
    <h3 className="mt-3 mb-1.5 flex items-center gap-2 text-sm font-semibold">
      <span
        className="size-3 rounded-full bg-muted-foreground/40"
        style={color ? { background: color } : undefined}
      />
      {title}
      <span className="text-xs font-normal text-muted-foreground">{count}</span>
    </h3>
  )

  const sections = searching ? searchSections(game, query) : actionSections(game)
  const titleOf = (id: string) => {
    const category = game.categories.find((c) => c.id === id)
    return { title: category?.name ?? t.noCategory, color: category?.color }
  }

  return (
    <div className="grid max-w-3xl gap-3">
      {game.actions.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-md border border-dashed p-8 text-center">
          <p className="font-medium">{t.emptyTitle}</p>
          <Button
            onClick={() => {
              setEditing('new')
            }}
          >
            <ListPlus />
            {t.addAction}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label={t.search}
                placeholder={t.search}
                className="pl-8"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                }}
              />
            </div>
            <Button
              className="ml-auto"
              onClick={() => {
                setEditing('new')
              }}
            >
              <ListPlus />
              {t.addAction}
            </Button>
          </div>
          {searching && sections.length === 0 && (
            <p className="text-sm text-muted-foreground">{t.notFound}</p>
          )}
          <div data-testid="action-list">
            <SectionedSortable
              disabled={searching}
              sections={sections.map((s) => ({
                id: s.category?.id ?? NO_CATEGORY,
                items: s.actions,
              }))}
              emptyText={t.sectionEmpty}
              onMove={(id, section, index) => {
                moveActionCmd(game.id, id, section === NO_CATEGORY ? null : section, index)
              }}
              renderSection={(id, list, count) => {
                const { title, color } = titleOf(id)
                return (
                  <section aria-label={title}>
                    {heading(title, color, count)}
                    {list}
                  </section>
                )
              }}
              renderItem={row}
            />
          </div>
        </>
      )}
      {editing && (
        <ActionDialog
          game={game}
          action={editing === 'new' ? null : editing}
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
          description={fill(t.deleteText, { count: actionBindingCount(game, deleting.id) })}
          onConfirm={() => {
            removeActionCmd(game.id, deleting.id)
            setDeleting(null)
          }}
        />
      )}
    </div>
  )
}
