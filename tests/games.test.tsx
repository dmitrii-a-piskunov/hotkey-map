import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from '@/app/app'
import { serializeAppData } from '@/domain/app-data'
import { useDataStore } from '@/features/data/store'
import { useDevicesStore, initialDevicesData } from '@/features/devices/store'
import { useGamesUi } from '@/features/games/ui-store'
import { PersistenceSession } from '@/features/persistence/session'
import { ru } from '@/i18n/ru'
import { at, sampleData } from './fixtures'
import { makeTestEnv, resetStores } from './mocks/persistence-env'

let session: PersistenceSession | null = null

beforeEach(() => {
  resetStores()
  useDevicesStore.setState(initialDevicesData)
  useGamesUi.setState({ editor: null, createGame: false, presets: false, profile: null })
})

afterEach(() => {
  session?.dispose()
  session = null
})

async function renderWith(data: ReturnType<typeof sampleData> | null) {
  const env = makeTestEnv({ savedFolder: true })
  if (data) env.folder.writeText('data.json', serializeAppData(data))
  session = new PersistenceSession(env.env)
  await session.start()
  render(<App session={session} />)
}

const games = () => useDataStore.getState().data.games

describe('games and profiles in the header (section 8.2)', () => {
  it('without games shows «Добавьте первую игру» and creates a game', async () => {
    const user = userEvent.setup()
    await renderWith(null)
    expect(screen.getByText(ru.games.emptyTitle)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: ru.games.createGame }))
    const dialog = screen.getByRole('dialog', { name: ru.games.createTitle })
    await user.type(within(dialog).getByLabelText(ru.games.name), 'Dota 2')
    await user.click(within(dialog).getByRole('button', { name: ru.common.create }))

    expect(games().map((g) => g.name)).toEqual(['Dota 2'])
    expect(screen.getByTestId('current-game')).toHaveTextContent('Dota 2')
    expect(screen.getByTestId('current-profile')).toHaveTextContent('Основной')
    expect(screen.queryByText(ru.games.emptyTitle)).not.toBeInTheDocument()
    // Редактор открывается сразу после создания
    expect(screen.getByRole('dialog', { name: 'Dota 2' })).toBeInTheDocument()
  })

  it('a duplicate game name blocks creation', async () => {
    const user = userEvent.setup()
    await renderWith(sampleData())
    useGamesUi.setState({ createGame: true })
    const dialog = await screen.findByRole('dialog', { name: ru.games.createTitle })
    await user.type(within(dialog).getByLabelText(ru.games.name), 'pubg')
    expect(within(dialog).getByText(ru.common.duplicate)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: ru.common.create })).toBeDisabled()
  })

  it('shows the current game and profile from the data', async () => {
    const data = sampleData()
    await renderWith(data)
    expect(screen.getByTestId('current-game')).toHaveTextContent('PUBG')
    expect(screen.getByTestId('current-profile')).toHaveTextContent('Основной')
    expect(screen.getByRole('button', { name: ru.games.openEditor })).toBeInTheDocument()
  })
})

describe('blocked keys of the game (FR-01, FR-05)', () => {
  it('a blocked key is not assignable and the hint names the game', async () => {
    const data = sampleData()
    at(data.games, 0).rules.blockedKeys = ['Fn', 'MetaLeft', 'Knob', 'Tab']
    await renderWith(data)

    const tab = document.querySelector<HTMLElement>('[data-input-code="Tab"]')
    if (!tab) throw new Error('no Tab key')
    expect(tab).toHaveAttribute('aria-disabled', 'true')

    fireEvent.pointerDown(tab, { button: 0 })
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent(
      'Эта клавиша не передаётся в PUBG',
    )
    fireEvent.pointerUp(window)

    // Обычный клик не выделяет непередаваемую клавишу
    useDevicesStore.getState().selectOnly('Tab')
    expect(useDevicesStore.getState().selection.selected).toEqual([])
    useDevicesStore.getState().selectOnly('KeyQ')
    expect(useDevicesStore.getState().selection.selected).toEqual(['KeyQ'])
  })
})
