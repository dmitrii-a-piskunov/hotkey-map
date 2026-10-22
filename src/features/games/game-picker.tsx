import { ChevronDown, PackagePlus, Plus, Settings2 } from 'lucide-react'
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
import { useDataStore } from '@/features/data/store'
import { ru } from '@/i18n/ru'
import { selectGameCmd } from './commands'
import { GameIcon } from './game-icon'
import { openEditor, useGamesUi } from './ui-store'
import { useCurrentGame } from './use-current'

/** Выбор игры с иконками в шапке (раздел 8.2) */
export function GamePicker() {
  const games = useDataStore((s) => s.data.games)
  const current = useCurrentGame()

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={ru.games.chooseGame} className="max-w-56">
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
    </div>
  )
}
