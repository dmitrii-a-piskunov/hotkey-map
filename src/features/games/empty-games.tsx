import { Gamepad2, PackagePlus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ru } from '@/i18n/ru'
import { useGamesUi } from './ui-store'

/** Пустое состояние «Нет игр» (раздел 8.2) */
export function EmptyGames() {
  return (
    <aside className="flex w-80 shrink-0 flex-col items-center justify-center gap-4 border-r p-6 text-center">
      <Gamepad2 className="size-10 text-muted-foreground" aria-hidden="true" />
      <div className="grid gap-1">
        <h2 className="text-base font-semibold">{ru.games.emptyTitle}</h2>
        <p className="text-sm text-muted-foreground">{ru.games.emptyText}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          onClick={() => {
            useGamesUi.setState({ createGame: true })
          }}
        >
          <Plus />
          {ru.games.createGame}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            useGamesUi.setState({ presets: true })
          }}
        >
          <PackagePlus />
          {ru.games.fromPresets}
        </Button>
      </div>
    </aside>
  )
}
