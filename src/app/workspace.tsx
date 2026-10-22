import type { ReactNode } from 'react'
import { AppHeader } from '@/components/header/app-header'
import { DeviceStage } from '@/components/devices/device-stage'
import { useKeyboardInput } from '@/features/devices/use-keyboard-input'

/** Главный экран: шапка, плашки, клавиатура и мышь */
export function Workspace({ banners }: { banners?: ReactNode }) {
  useKeyboardInput()

  return (
    <div className="flex h-screen min-w-[1280px] flex-col bg-background text-foreground">
      <AppHeader />
      {banners}
      <main className="flex min-h-0 flex-1">
        <DeviceStage />
      </main>
    </div>
  )
}
