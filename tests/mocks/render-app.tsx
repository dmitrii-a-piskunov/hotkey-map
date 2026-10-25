import { render } from '@testing-library/react'
import { App } from '@/app/app'
import { serializeAppData } from '@/domain/app-data'
import type { AppData } from '@/domain/types'
import { useBindingsUi } from '@/features/bindings/ui-store'
import { initialDevicesData, useDevicesStore } from '@/features/devices/store'
import { PersistenceSession } from '@/features/persistence/session'
import { makeTestEnv, resetStores } from './persistence-env'

let session: PersistenceSession | null = null

/** Сброс хранилищ перед тестом главного экрана */
export function resetAppStores(): void {
  resetStores()
  useDevicesStore.setState(initialDevicesData)
  useBindingsUi.setState({
    layer: '',
    capture: null,
    highlight: null,
    tab: 'actions',
  })
}

export function disposeApp(): void {
  session?.dispose()
  session = null
}

/** Главный экран с данными в папке, как после запуска приложения */
export async function renderApp(data: AppData): Promise<void> {
  const env = makeTestEnv({ savedFolder: true })
  env.folder.writeText('data.json', serializeAppData(data))
  session = new PersistenceSession(env.env)
  await session.start()
  render(<App session={session} />)
}
