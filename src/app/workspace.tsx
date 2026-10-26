import type { ReactNode } from 'react'
import { AppHeader } from '@/components/header/app-header'
import { ViewBar } from '@/components/header/view-bar'
import { DeviceStage } from '@/components/devices/device-stage'
import { StageToolbar } from '@/components/devices/stage-toolbar'
import { SidePanel } from '@/features/bindings/panel/side-panel'
import { useDataStore, useSettings } from '@/features/data/store'
import { useKeyboardInput } from '@/features/devices/use-keyboard-input'
import { EmptyGames } from '@/features/games/empty-games'
import { GamesDialogs } from '@/features/games/games-dialogs'
import { UndoToast } from '@/features/history/undo-toast'
import { ImportDialog } from '@/features/transfer/import-dialog'
import { useImportDrop } from '@/features/transfer/use-import-drop'

/** Главный экран: шапка, плашки, полоса вида, клавиатура и мышь; без игр — «Добавьте первую игру» */
export function Workspace({ banners }: { banners?: ReactNode }) {
  useKeyboardInput()
  useImportDrop()
  const hasGames = useDataStore((s) => s.data.games.length > 0)
  const showKeyboard = useSettings((s) => s.showKeyboard)
  const showMouse = useSettings((s) => s.showMouse)
  // Клавиатура и мышь скрыты — панель становится окном настроек по центру
  const wide = hasGames && !showKeyboard && !showMouse

  return (
    <div className="flex h-screen min-w-[1280px] flex-col bg-background text-foreground">
      <AppHeader />
      {banners}
      <ViewBar />
      <main className="flex min-h-0 flex-1">
        {!hasGames && <EmptyGames />}
        {!wide && (
          <div className="flex min-w-0 flex-1 flex-col">
            {hasGames && <StageToolbar />}
            <DeviceStage />
          </div>
        )}
        {hasGames && <SidePanel wide={wide} />}
      </main>
      <GamesDialogs />
      <ImportDialog />
      <UndoToast />
    </div>
  )
}
