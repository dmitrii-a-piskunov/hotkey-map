import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'
import { addPresetGameCmd } from './commands'
import { GameIcon } from './game-icon'
import { loadPresets, type Preset } from './presets'
import { useGamesUi } from './ui-store'

function PresetList() {
  const [presets, setPresets] = useState<Preset[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    loadPresets()
      .then((list) => {
        if (alive) setPresets(list)
      })
      .catch((e: unknown) => {
        console.error('Loading presets failed', e)
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [])

  if (failed) return <p className="text-sm text-destructive">{ru.games.presetsFailed}</p>
  if (!presets) return <p className="text-sm text-muted-foreground">{ru.storage.loading}</p>

  return (
    <ul className="grid gap-2">
      {presets.map(({ key, game }) => (
        <li key={key} className="flex items-center gap-3 rounded-md border p-3">
          <GameIcon game={game} className="size-8" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{game.name}</div>
            <div className="text-xs text-muted-foreground">
              {fill(ru.games.presetStats, {
                actions: game.actions.length,
                settings: game.settingsTemplate.length,
              })}
            </div>
          </div>
          <Button
            size="sm"
            aria-label={`${ru.common.add} ${game.name}`}
            onClick={() => {
              addPresetGameCmd(game)
              useGamesUi.setState({ presets: false })
            }}
          >
            {ru.common.add}
          </Button>
        </li>
      ))}
    </ul>
  )
}

/** «Из заготовок» (FR-22): игра добавляется копией с новыми id */
export function PresetsDialog() {
  const open = useGamesUi((s) => s.presets)
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        useGamesUi.setState({ presets: o })
      }}
    >
      <DialogContent closeLabel={ru.common.close}>
        <DialogHeader>
          <DialogTitle>{ru.games.presetsTitle}</DialogTitle>
          <DialogDescription>{ru.games.presetsText}</DialogDescription>
        </DialogHeader>
        {open && <PresetList />}
      </DialogContent>
    </Dialog>
  )
}
