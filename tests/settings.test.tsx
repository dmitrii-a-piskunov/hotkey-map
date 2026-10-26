import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from '@/app/app'
import { serializeAppData } from '@/domain/app-data'
import { PersistenceSession } from '@/features/persistence/session'
import { useSettingsDialog } from '@/features/settings/settings-ui'
import { ru } from '@/i18n/ru'
import { sampleData, sampleGame } from './fixtures'
import { memoryFolder } from './mocks/memory-fs'
import { makeTestEnv, resetStores, type TestEnv } from './mocks/persistence-env'

const t = ru.settings
let session: PersistenceSession | null = null

beforeEach(() => {
  resetStores()
  useSettingsDialog.setState({ open: false })
})
afterEach(() => {
  session?.dispose()
  session = null
})

async function renderWithFolder(): Promise<TestEnv> {
  const env = makeTestEnv({ savedFolder: true })
  env.folder.writeText('data.json', serializeAppData(sampleData()))
  session = new PersistenceSession(env.env)
  await session.start()
  render(<App session={session} />)
  return env
}

async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: ru.transfer.menu }))
  await user.click(await screen.findByRole('menuitem', { name: t.menuItem }))
  return screen.findByRole('dialog', { name: t.title })
}

describe('settings: data folder (FR-19)', () => {
  it('shows the folder and moves data into an empty one', async () => {
    const user = userEvent.setup()
    const env = await renderWithFolder()
    const dialog = await openSettings(user)
    expect(within(dialog).getByTestId('settings-folder')).toHaveTextContent('hotkey-map-test')

    env.folder = memoryFolder('новая')
    await user.click(within(dialog).getByRole('button', { name: t.changeFolder }))
    expect(await within(dialog).findByRole('status')).toHaveTextContent(
      'Данные и иконки перенесены в папку «новая»',
    )
    expect(within(dialog).getByTestId('settings-folder')).toHaveTextContent('новая')
    expect(await env.folder.readText('data.json')).toContain('PUBG')
  })

  it('asks what to do with a folder that has data and opens it', async () => {
    const user = userEvent.setup()
    const env = await renderWithFolder()
    const dialog = await openSettings(user)

    const next = memoryFolder('с-данными')
    next.writeText(
      'data.json',
      serializeAppData({ ...sampleData(), games: [{ ...sampleGame(), name: 'Dota 2' }] }),
    )
    env.folder = next
    await user.click(within(dialog).getByRole('button', { name: t.changeFolder }))
    const choice = await within(dialog).findByRole('group', { name: t.hasDataTitle })
    await user.click(within(choice).getByRole('button', { name: t.openFolderData }))

    expect(await within(dialog).findByRole('status')).toHaveTextContent(
      'Открыты данные папки «с-данными»',
    )
    await user.keyboard('{Escape}')
    expect(screen.getByTestId('current-game')).toHaveTextContent('Dota 2')
  })

  it('the Firefox mode has no folder to change', async () => {
    const user = userEvent.setup()
    const env = makeTestEnv({ supported: false })
    session = new PersistenceSession(env.env)
    await session.start()
    render(<App session={session} />)
    const dialog = await openSettings(user)
    expect(dialog).toHaveTextContent(t.browserMode)
    expect(within(dialog).queryByRole('button', { name: t.changeFolder })).toBeNull()
  })
})
