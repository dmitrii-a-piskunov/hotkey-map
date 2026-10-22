import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '@/app/app'
import { serializeAppData } from '@/domain/app-data'
import { PersistenceSession, SAVE_DELAY_MS } from '@/features/persistence/session'
import { ru } from '@/i18n/ru'
import { sampleData } from './fixtures'
import { asHandle } from './mocks/memory-fs'
import { makeTestEnv, resetStores, settings, type TestEnv } from './mocks/persistence-env'

const t = ru.storage
let session: PersistenceSession | null = null

beforeEach(() => {
  resetStores()
})

afterEach(() => {
  session?.dispose()
  session = null
})

async function renderApp(env: TestEnv) {
  session = new PersistenceSession(env.env)
  await session.start()
  render(<App session={session} />)
}

describe('App', () => {
  it('first launch: welcome screen, then the main screen after choosing a folder', async () => {
    const user = userEvent.setup()
    const env = makeTestEnv()
    await renderApp(env)
    expect(screen.getByRole('heading', { name: t.welcomeTitle })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t.chooseFolder }))
    expect(await screen.findByRole('heading', { name: ru.app.title })).toBeInTheDocument()
    expect(screen.getByText(__APP_VERSION__)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: ru.devices.keyboard })).toBeInTheDocument()
    expect(screen.getByTestId('save-status')).toHaveTextContent(t.statusSaved)
  })

  it('shows the save status in the header (FR-19)', async () => {
    const user = userEvent.setup()
    const env = makeTestEnv({ savedFolder: true })
    await renderApp(env)
    const statusEl = screen.getByTestId('save-status')
    expect(statusEl).toHaveTextContent(t.statusSaved)

    await user.click(screen.getByRole('radio', { name: '2D' }))
    expect(statusEl).toHaveTextContent(t.statusSaving)
    await waitFor(
      () => {
        expect(statusEl).toHaveTextContent(t.statusSaved)
      },
      { timeout: SAVE_DELAY_MS * 2 },
    )
    expect(await env.folder.readText('data.json')).toContain('"view": "2d"')
  })

  it('Firefox mode shows the banner (FR-23)', async () => {
    await renderApp(makeTestEnv({ supported: false }))
    expect(await screen.findByText(t.browserMode)).toBeInTheDocument()
  })

  it('TC-12: corrupted data.json offers to restore a backup', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const user = userEvent.setup()
    const env = makeTestEnv({ savedFolder: true })
    const backup = sampleData()
    backup.appSettings.view = '2d'
    await env.env.openFolder(asHandle(env.folder))
    env.folder.dir('backups').writeText('data-2026-10-21_09-30-00.json', serializeAppData(backup))
    env.folder.writeText('data.json', '{ broken')

    await renderApp(env)
    expect(screen.getByRole('heading', { name: t.corruptedTitle })).toBeInTheDocument()
    const list = screen.getByRole('list', { name: t.backupsTitle })
    expect(within(list).getByText('21.10.2026 09:30')).toBeInTheDocument()

    await user.click(within(list).getByRole('button', { name: t.restore }))
    await user.click(within(list).getByRole('button', { name: t.confirm }))
    expect(await screen.findByRole('heading', { name: ru.app.title })).toBeInTheDocument()
    expect(settings().view).toBe('2d')
    expect(await env.folder.readText('data.json')).toContain('"name": "PUBG"')
  })
})
