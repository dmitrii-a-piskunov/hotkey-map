import { Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { nameErrorText } from '@/components/common/field-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { NameError } from '@/domain/names'
import { ru } from '@/i18n/ru'

interface AddRowProps {
  id: string
  placeholder: string
  max: number
  validate: (name: string) => NameError | null
  onAdd: (name: string) => void
  /** Дополнительные поля между названием и кнопкой (цвет категории) */
  extra?: ReactNode
}

/** Поле и кнопка «Добавить» под списком; Enter тоже добавляет */
export function AddRow({ id, placeholder, max, validate, onAdd, extra }: AddRowProps) {
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const error = validate(name)
  const shown = touched && name !== '' ? nameErrorText(error, max) : null

  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (error) return
        onAdd(name)
        setName('')
        setTouched(false)
      }}
    >
      <div className="flex items-start gap-2">
        <Input
          id={id}
          aria-label={placeholder}
          placeholder={placeholder}
          className="max-w-xs"
          value={name}
          aria-invalid={shown ? true : undefined}
          onChange={(e) => {
            setName(e.target.value)
            setTouched(true)
          }}
        />
        <Button type="submit" variant="outline" disabled={error !== null}>
          <Plus />
          {ru.common.add}
        </Button>
      </div>
      {extra}
      {shown && <p className="text-xs text-destructive">{shown}</p>}
    </form>
  )
}
