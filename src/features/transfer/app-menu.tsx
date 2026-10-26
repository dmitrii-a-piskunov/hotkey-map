import { Download, Menu, Settings, Upload } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ExportTarget } from '@/domain/export'
import { useCurrentGame, useCurrentProfile } from '@/features/games/use-current'
import { usePersistence } from '@/features/persistence/persistence-context'
import { ru } from '@/i18n/ru'
import { openSettings } from '@/features/settings/settings-ui'
import { exportToFile } from './export'
import { openImportFile } from './import'

const t = ru.transfer

/** Меню в шапке (раздел 8.2): импорт, экспорт и «Настройки» */
export function AppMenu() {
  const session = usePersistence()
  const game = useCurrentGame()
  const profile = useCurrentProfile()
  const fileInput = useRef<HTMLInputElement>(null)

  const run = (target: ExportTarget) => {
    void exportToFile(session, target)
  }

  return (
    <>
      {/* Окно выбора файла: вне меню, потому что меню закрывается раньше */}
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        data-testid="import-input"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void openImportFile(file)
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t.menu} title={t.menu}>
            <Menu />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem
            onSelect={() => {
              fileInput.current?.click()
            }}
          >
            <Upload />
            {ru.import.menuItem}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={openSettings}>
            <Settings />
            {ru.settings.menuItem}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
