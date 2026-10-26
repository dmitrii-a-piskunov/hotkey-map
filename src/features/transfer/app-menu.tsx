import { Download, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ExportTarget } from '@/domain/export'
import { useCurrentGame, useCurrentProfile } from '@/features/games/use-current'
import { usePersistence } from '@/features/persistence/persistence-context'
import { ru } from '@/i18n/ru'
import { exportToFile } from './export'

const t = ru.transfer

/** Меню в шапке (раздел 8.2): экспорт; импорт и настройки — следующими шагами этапа 5 */
export function AppMenu() {
  const session = usePersistence()
  const game = useCurrentGame()
  const profile = useCurrentProfile()

  const run = (target: ExportTarget) => {
    void exportToFile(session, target)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t.menu} title={t.menu}>
          <Menu />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel>{t.export}</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => {
            run({ scope: 'all' })
          }}
        >
          <Download />
          {t.exportAll}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!game}
          onSelect={() => {
            if (game) run({ scope: 'game', gameId: game.id })
          }}
        >
          <Download />
          {t.exportGame}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!game || !profile}
          onSelect={() => {
            if (game && profile) run({ scope: 'profile', gameId: game.id, profileId: profile.id })
          }}
        >
          <Download />
          {t.exportProfile}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
