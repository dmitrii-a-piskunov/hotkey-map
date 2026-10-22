import { Check, Pencil, X } from 'lucide-react'
import { useState } from 'react'
import { nameErrorText } from '@/components/common/field-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { NameError } from '@/domain/names'
import { ru } from '@/i18n/ru'

interface InlineNameProps {
  name: string
  max: number
  validate: (name: string) => NameError | null
  onSave: (name: string) => void
}

/** Название в строке списка с правкой на месте: Enter сохраняет, Esc отменяет */
export function InlineName({ name, max, validate, onSave }: InlineNameProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const error = nameErrorText(validate(value), max)
  const dirty = value.trim() !== name

  function cancel() {
    setEditing(false)
    setValue(name)
  }

  if (!editing) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm" title={name}>
          {name}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={`${ru.common.edit} ${name}`}
          onClick={() => {
            setValue(name)
            setEditing(true)
          }}
        >
          <Pencil />
        </Button>
      </div>
    )
  }

  return (
    <form
      // Esc здесь отменяет правку, а не закрывает редактор (game-editor.tsx)
      data-escape-local
      className="grid min-w-0 flex-1 gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (error) return
        if (dirty) onSave(value)
        setEditing(false)
      }}
    >
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          aria-label={ru.games.name}
          className="h-8"
          value={value}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setValue(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              cancel()
            }
          }}
        />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={ru.common.save}
          disabled={error !== null}
        >
          <Check />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={ru.common.cancel}
          onClick={cancel}
        >
          <X />
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  )
}
