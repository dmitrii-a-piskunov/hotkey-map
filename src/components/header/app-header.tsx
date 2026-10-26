import { Keyboard } from 'lucide-react'
import { IssuesButton } from '@/features/bindings/issues-button'
import { GamePicker } from '@/features/games/game-picker'
import { HistoryButtons } from '@/features/history/history-buttons'
import { ProfilePicker } from '@/features/profiles/profile-picker'
import { SaveStatusIndicator } from '@/features/persistence/storage-banners'
import { AppMenu } from '@/features/transfer/app-menu'
import { ru } from '@/i18n/ru'

/** Шапка (раздел 8.2): игра, профиль, конфликты, отмена и повтор, статус сохранения, меню */
export function AppHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
      <div className="flex items-center gap-2">
        <Keyboard className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-base font-semibold tracking-tight whitespace-nowrap max-2xl:sr-only">
          {ru.app.title}
        </h1>
        <span className="text-xs text-muted-foreground max-2xl:hidden">{__APP_VERSION__}</span>
      </div>
      <div className="flex min-w-0 items-center gap-1 border-l pl-3">
        <GamePicker />
        <ProfilePicker />
        <IssuesButton />
      </div>
      <HistoryButtons />
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <SaveStatusIndicator />
        <AppMenu />
      </div>
    </header>
  )
}
