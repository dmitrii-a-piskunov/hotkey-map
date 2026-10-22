import { ChevronDown, PackagePlus, Plus, Settings2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { gameImpact } from '@/domain/games'
import { useDataStore } from '@/features/data/store'
import { ru } from '@/i18n/ru'
import { fill } from '@/lib/format'
import { removeGameCmd, selectGameCmd } from './commands'
import { GameIcon } from './game-icon'
import { openEditor, useGamesUi } from './ui-store'
import { useCurrentGame } from './use-current'

/** Выбор игры с иконками в шапке (раздел 8.2) */
export function GamePicker() {
  const games = useDataStore((s) => s.data.games)
  const current = useCurrentGame()
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={ru.games.chooseGame}>
            {current ? (
              <>
                <GameIcon game={current} className="size-5" />
                <span className="truncate" data-testid="current-game">
                  {current.name}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">{ru.games.noGames}</span>
            )}
            <ChevronDown className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {games.length > 0 && (
            <>
              <DropdownMenuRadioGroup
                value={current?.id ?? ''}
                onValueChange={(id) => {
                  selectGameCmd(id)
                }}
              >
                {games.map((g) => (
                  <DropdownMenuRadioItem key={g.id} value={g.id} title={g.name}>
                    <GameIcon game={g} className="size-5" />
                    <span className="truncate">{g.name}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onSelect={() => {
              useGamesUi.setState({ createGame: true })
            }}
          >
            <Plus />
            {ru.games.createGame}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              useGamesUi.setState({ presets: true })
            }}
          >
            <PackagePlus />
            {ru.games.fromPresets}
          </DropdownMenuItem>
          {current && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  setConfirmDelete(true)
                }}
              >
                <Trash2 />
                {ru.editor.general.deleteGame}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {current && (
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={ru.games.openEditor}
          title={ru.games.openEditor}
          onClick={() => {
            openEditor(current.id)
          }}
        >
          <Settings2 />
        </Button>
      )}
      {current && (
        // Удаление игры со всеми данными после подтверждения (FR-05, раздел 9.2)
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={fill(ru.editor.general.deleteTitle, { name: current.name })}
          description={fill(ru.editor.general.deleteText, { ...gameImpact(current) })}
          onConfirm={() => {
            removeGameCmd(current.id)
          }}
        />
      )}
    </div>
  )
}
