import { Lock, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { SortableList, SortableRow } from '@/components/common/sortable'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/input'
import { contextNameError, contextUsage, globalContext, sortedContexts } from '@/domain/contexts'
import { LIMITS } from '@/domain/names'
import type { Context, Game } from '@/domain/types'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'
import { addContextCmd, removeContextCmd, renameContextCmd, reorderContextsCmd } from '../commands'
import { AddRow } from './add-row'
import { InlineName } from './inline-name'

const t = ru.editor.contexts

function DeleteContextDialog({
  game,
  context,
  onClose,
}: {
  game: Game
  context: Context
  onClose: () => void
}) {
  const count = contextUsage(game, context.id)
  const targets = sortedContexts(game).filter((c) => c.id !== context.id)
  const [moveTo, setMoveTo] = useState(globalContext(game).id)
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      title={fill(t.deleteTitle, { name: context.name })}
      description={count > 0 ? fill(t.deleteText, { count }) : t.deleteSimple}
      onConfirm={() => {
        removeContextCmd(game.id, context.id, moveTo)
        onClose()
      }}
    >
      {count > 0 && (
        <label className="grid gap-1.5 text-sm">
          {t.moveTo}
          <NativeSelect
            value={moveTo}
            onChange={(e) => {
              setMoveTo(e.target.value)
            }}
          >
            {targets.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </label>
      )}
    </ConfirmDialog>
  )
}

/** Вкладка «Контексты» (FR-06) */
export function ContextsTab({ game }: { game: Game }) {
  const [deleting, setDeleting] = useState<Context | null>(null)
  const contexts = sortedContexts(game)
  const global = contexts.filter((c) => c.isGlobal)
  const rest = contexts.filter((c) => !c.isGlobal)

  const nameRow = (c: Context) => (
    <>
      <InlineName
        name={c.name}
        max={LIMITS.context}
        validate={(name) => contextNameError(game, name, c.id)}
        onSave={(name) => {
          renameContextCmd(game.id, c.id, name)
        }}
      />
      <span className="shrink-0 text-xs text-muted-foreground">
        {fill(t.usage, { count: contextUsage(game, c.id) })}
      </span>
    </>
  )

  return (
    <div className="grid max-w-2xl gap-4">
      <p className="text-sm text-muted-foreground">{t.hint}</p>
      <ul className="grid gap-1.5">
        {global.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5"
          >
            <span className="flex w-6 justify-center text-muted-foreground" title={t.global}>
              <Lock className="size-3.5" />
            </span>
            {nameRow(c)}
            <span className="w-7" />
          </li>
        ))}
      </ul>
      <SortableList
        items={rest}
        onReorder={(ids) => {
          reorderContextsCmd(game.id, ids)
        }}
        renderItem={(c) => (
          <SortableRow key={c.id} id={c.id}>
            {nameRow(c)}
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
      <AddRow
        id="new-context"
        placeholder={t.newName}
        max={LIMITS.context}
        validate={(name) => contextNameError(game, name)}
        onAdd={(name) => {
          addContextCmd(game.id, name)
        }}
      />
      {deleting && (
        <DeleteContextDialog
          game={game}
          context={deleting}
          onClose={() => {
            setDeleting(null)
          }}
        />
      )}
    </div>
  )
}
