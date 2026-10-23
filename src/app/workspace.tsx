import type { ReactNode } from 'react'
import { AppHeader } from '@/components/header/app-header'
import { DeviceStage } from '@/components/devices/device-stage'
import { StageToolbar } from '@/components/devices/stage-toolbar'
import { SidePanel } from '@/features/bindings/panel/side-panel'
import { useDataStore } from '@/features/data/store'
import { useKeyboardInput } from '@/features/devices/use-keyboard-input'
import { EmptyGames } from '@/features/games/empty-games'
import { GamesDialogs } from '@/features/games/games-dialogs'

/** Главный экран: шапка, плашки, клавиатура и мышь; без игр — «Добавьте первую игру» */
export function Workspace({ banners }: { banners?: ReactNode }) {
  useKeyboardInput()
  const hasGames = useDataStore((s) => s.data.games.length > 0)

  return (
    <div className="flex h-screen min-w-[1280px] flex-col bg-background text-foreground">
      <AppHeader />
      {banners}
      <main className="flex min-h-0 flex-1">
        {!hasGames && <EmptyGames />}
        <div className="flex min-w-0 flex-1 flex-col">
          {hasGames && <StageToolbar />}
          <DeviceStage />
        </div>
        {hasGames && <SidePanel />}
      </main>
      <GamesDialogs />
    </div>
  )
}
