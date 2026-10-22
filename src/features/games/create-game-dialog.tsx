import { useState } from 'react'
import { Field } from '@/components/common/field'
import { invalidProps, nameErrorText } from '@/components/common/field-errors'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { gameNameError } from '@/domain/games'
import { LIMITS } from '@/domain/names'
import { useDataStore } from '@/features/data/store'
import { ru } from '@/i18n/ru'
import { createGameCmd } from './commands'
import { openEditor, useGamesUi } from './ui-store'

function CreateGameForm() {
  const data = useDataStore((s) => s.data)
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const error = gameNameError(data, name)
  const shown = touched ? nameErrorText(error, LIMITS.game) : null

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (error) return
        const id = createGameCmd(name)
        useGamesUi.setState({ createGame: false })
        openEditor(id)
      }}
    >
      <Field label={ru.games.name} htmlFor="new-game-name" error={shown}>
        <Input
          id="new-game-name"
          autoFocus
          value={name}
          maxLength={LIMITS.game + 20}
          onChange={(e) => {
            setName(e.target.value)
            setTouched(true)
          }}
          {...invalidProps('new-game-name', shown)}
        />
      </Field>
      <DialogFooter className="sm:justify-between">
        <Button
          type="button"
          variant="link"
          className="px-0"
          onClick={() => {
            useGamesUi.setState({ createGame: false, presets: true })
          }}
        >
          {ru.games.addFromPresets}
        </Button>
        <Button type="submit" disabled={touched && error !== null}>
          {ru.common.create}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Создание игры: название, потом редактор (FR-05) */
export function CreateGameDialog() {
  const open = useGamesUi((s) => s.createGame)
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        useGamesUi.setState({ createGame: o })
      }}
    >
      <DialogContent closeLabel={ru.common.close}>
        <DialogHeader>
          <DialogTitle>{ru.games.createTitle}</DialogTitle>
          <DialogDescription>{ru.games.createText}</DialogDescription>
        </DialogHeader>
        {open && <CreateGameForm />}
      </DialogContent>
    </Dialog>
  )
}
