import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Field } from '@/components/common/field'
import { invalidProps, nameErrorText } from '@/components/common/field-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  bindParamErrors,
  bindParamImpact,
  hasBindParamErrors,
  keptOptionIds,
  type BindParamDraft,
} from '@/domain/bind-param'
import { LIMITS } from '@/domain/names'
import { moveItem } from '@/domain/order'
import type { Game } from '@/domain/types'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'
import { removeBindParamCmd, setBindParamCmd } from '../commands'

const t = ru.editor.bindParam

/** Строка варианта: key — для React, id есть только у сохранённых вариантов */
interface OptionRow {
  key: number
  id?: string
  name: string
}

let nextKey = 0

function rowsOf(game: Game): OptionRow[] {
  return (game.bindParam?.options ?? []).map((o) => ({ key: nextKey++, id: o.id, name: o.name }))
}

function toDraft(name: string, rows: readonly OptionRow[]): BindParamDraft {
  return { name, options: rows.map((r) => (r.id ? { id: r.id, name: r.name } : { name: r.name })) }
}

function ParamForm({ game, onDone }: { game: Game; onDone: () => void }) {
  const [name, setName] = useState(game.bindParam?.name ?? '')
  const [rows, setRows] = useState<OptionRow[]>(() =>
    game.bindParam ? rowsOf(game) : [{ key: nextKey++, name: '' }],
  )
  const [touched, setTouched] = useState(game.bindParam !== undefined)
  const [confirm, setConfirm] = useState(false)
  const draft = toDraft(name, rows)
  const errors = bindParamErrors(draft)
  const invalid = hasBindParamErrors(errors)
  const impact = bindParamImpact(game, keptOptionIds(draft))
  const nameError = touched ? nameErrorText(errors.name, LIMITS.bindParam) : null

  function save() {
    setBindParamCmd(game.id, draft)
    onDone()
  }

  function updateRow(key: number, value: string) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, name: value } : r)))
    setTouched(true)
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (invalid) return
        if (impact > 0) setConfirm(true)
        else save()
      }}
    >
      <Field label={t.name} htmlFor="param-name" error={nameError} className="max-w-sm">
        <Input
          id="param-name"
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setTouched(true)
          }}
          {...invalidProps('param-name', nameError)}
        />
      </Field>
      <div className="grid gap-2">
        <span className="text-sm font-medium">{t.options}</span>
        <ol className="grid gap-1.5">
          {rows.map((r, i) => {
            const error = touched ? nameErrorText(errors.options[i], LIMITS.option) : null
            const label = fill(t.option, { n: i + 1 })
            return (
              <li key={r.key} className="grid gap-1">
                <div className="flex items-center gap-1">
                  <Input
                    aria-label={label}
                    className="h-8 max-w-sm"
                    value={r.name}
                    aria-invalid={error ? true : undefined}
                    onChange={(e) => {
                      updateRow(r.key, e.target.value)
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`${ru.common.moveUp}: ${label}`}
                    disabled={i === 0}
                    onClick={() => {
                      setRows((rs) => moveItem(rs, i, i - 1))
                    }}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`${ru.common.moveDown}: ${label}`}
                    disabled={i === rows.length - 1}
                    onClick={() => {
                      setRows((rs) => moveItem(rs, i, i + 1))
                    }}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`${ru.common.delete}: ${label}`}
                    onClick={() => {
                      setRows((rs) => rs.filter((x) => x.key !== r.key))
                      setTouched(true)
                    }}
                  >
                    <X />
                  </Button>
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
              </li>
            )
          })}
        </ol>
        {touched && errors.noOptions && <p className="text-xs text-destructive">{t.noOptions}</p>}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setRows((rs) => [...rs, { key: nextKey++, name: '' }])
            }}
          >
            <Plus />
            {t.addOption}
          </Button>
        </div>
      </div>
      {impact > 0 && (
        <p role="status" className="text-sm text-warning">
          {fill(t.optionsLost, { count: impact })}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={touched && invalid}>
          {ru.common.save}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          {ru.common.cancel}
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t.confirmSaveTitle}
        description={fill(t.optionsLost, { count: impact })}
        confirmLabel={ru.common.save}
        onConfirm={save}
      />
    </form>
  )
}

/** Вкладка «Параметр бинда» (FR-09) */
export function BindParamTab({ game }: { game: Game }) {
  const [editing, setEditing] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const param = game.bindParam

  return (
    <div className="grid max-w-2xl gap-4">
      <p className="text-sm text-muted-foreground">{t.hint}</p>
      {editing ? (
        <ParamForm
          game={game}
          onDone={() => {
            setEditing(false)
          }}
        />
      ) : param ? (
        <div className="grid gap-3 rounded-md border p-4">
          <div className="font-medium">{param.name}</div>
          <ol className="flex flex-wrap gap-1.5">
            {param.options.map((o) => (
              <li key={o.id} className="rounded bg-muted px-2 py-0.5 text-sm">
                {o.name}
              </li>
            ))}
          </ol>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditing(true)
              }}
            >
              {ru.common.edit}
            </Button>
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => {
                setConfirmRemove(true)
              }}
            >
              <Trash2 />
              {t.removeParam}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid justify-items-start gap-3">
          <p className="text-sm">{t.none}</p>
          <Button
            onClick={() => {
              setEditing(true)
            }}
          >
            <Plus />
            {t.create}
          </Button>
        </div>
      )}
      {param && (
        <ConfirmDialog
          open={confirmRemove}
          onOpenChange={setConfirmRemove}
          title={fill(t.removeTitle, { name: param.name })}
          description={fill(t.removeText, { count: bindParamImpact(game, null) })}
          onConfirm={() => {
            removeBindParamCmd(game.id)
          }}
        />
      )}
    </div>
  )
}
