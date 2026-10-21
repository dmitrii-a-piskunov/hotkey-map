import { AppHeader } from '@/components/header/app-header'
import { DeviceStage } from '@/components/devices/device-stage'
import { useKeyboardInput } from '@/features/devices/use-keyboard-input'

export function App() {
  useKeyboardInput()

  return (
    <div className="flex h-screen min-w-[1280px] flex-col bg-background text-foreground">
      <AppHeader />
      <main className="flex min-h-0 flex-1">
        <DeviceStage />
      </main>
    </div>
  )
}
