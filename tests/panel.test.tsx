import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AppData, Game } from '@/domain/types'
import { useDataStore } from '@/features/data/store'
import { runFlushHooks } from '@/features/data/flush-hooks'
import { ru } from '@/i18n/ru'
import { at, sampleData, sampleGame } from './fixtures'
import { disposeApp, renderApp, resetAppStores } from './mocks/render-app'

const GLOBAL = '22222222-2222-4222-8222-222222222220'
const FIRE = '44444444-4444-4444-8444-444444444442'

/** Фикстура: «Прыжок» на пробеле (Пешком, Движение) и «Огонь» без клавиши (Везде) */
function data(patch: Partial<Game> = {}): AppData {
  const game = sampleGame()
  return {
    ...sampleData(),
    games: [
      {
        ...game,
        actions: [
          ...game.actions,
          { id: FIRE, name: 'Огонь', nameEn: 'Fire', contextId: GLOBAL, order: 1 },
        ],
        ...patch,
      },
    ],
  }
}

function input(code: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-input-code="${code}"]`)
  if (!el) throw new Error(`No input ${code}`)
  return el
}

const panel = () => screen.getByRole('complementary', { name: ru.panel.label })
const bindDialog = () => screen.getByRole('dialog', { name: ru.bindings.dialogTitle })

async function openFireDialog(user: ReturnType<typeof userEvent.setup>) {
  const fire = within(panel()).getByRole('group', { name: 'Огонь' })
  await user.click(within(fire).getByRole('button', { name: /Клавиша 1 действия «Огонь»/ }))
}
const profile = () => at(at(useDataStore.getState().data.games, 0).profiles, 0)
const bindingsOf = (actionId: string) =>
  profile()
    .bindings.filter((b) => b.actionId === actionId)
    .map((b) => b.input.code)

beforeEach(resetAppStores)
afterEach(disposeApp)

describe('assigning from the panel (FR-12, FR-13, FR-17)', () => {
  it('TC-01: select Q and assign an action — Q gets the category colour', async () => {
    const user = userEvent.setup()
    await renderApp(data())
    fireEvent.click(input('KeyQ'))
    expect(within(panel()).getByText(ru.panel.nothingOnKey)).toBeInTheDocument()
    await user.click(within(panel()).getByRole('button', { name: ru.panel.assignAction }))
    const picker = await screen.findByRole('dialog', { name: /Выбор действия для Q/ })
    await user.click(within(picker).getByRole('button', { name: /Прыжок/ }))
    expect(within(bindDialog()).getByTestId('capture-box')).toHaveTextContent('Q')
    await user.click(within(bindDialog()).getByRole('button', { name: ru.bindings.confirm }))
    expect(bindingsOf('44444444-4444-4444-8444-444444444441')).toEqual(['Space', 'KeyQ'])
    expect(input('KeyQ').style.getPropertyValue('--cap-top')).toBe('#3B82F6')
    expect(within(panel()).getByRole('group', { name: 'Прыжок' })).toBeInTheDocument()
  })

  it('TC-02: with one key per action a bound action cannot be picked', async () => {
    const user = userEvent.setup()
    const base = sampleGame()
    await renderApp(data({ rules: { ...base.rules, maxKeysPerAction: 1 } }))
    fireEvent.click(input('KeyW'))
    await user.click(within(panel()).getByRole('button', { name: ru.panel.assignAction }))
    const picker = await screen.findByRole('dialog', { name: /Выбор действия для W/ })
    const jump = within(picker).getByRole('button', { name: /Прыжок/ })
    expect(jump).toBeDisabled()
    expect(jump).toHaveAttribute('title', expect.stringContaining('1 из 1'))
    expect(within(picker).getByRole('button', { name: /Огонь/ })).toBeEnabled()
  })

  it('the key button opens the bind window; a conflict is shown before saving', async () => {
    const user = userEvent.setup()
    await renderApp(data())
    const fire = within(panel()).getByRole('group', { name: 'Огонь' })
    await user.click(within(fire).getByRole('button', { name: /Клавиша 1 действия «Огонь»/ }))
    const dialog = bindDialog()
    expect(dialog).toHaveTextContent('Огонь')
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    expect(within(dialog).getByTestId('capture-box')).toHaveTextContent('Space')
    expect(bindingsOf(FIRE)).toEqual([])

    // «Огонь» (Везде) и «Прыжок» (Пешком) на пробеле — конфликт, видно до сохранения
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Клавиша уже привязана к действию «Прыжок»',
    )
    await user.click(within(dialog).getByRole('button', { name: ru.bindings.confirmReplace }))
    expect(bindingsOf(FIRE)).toEqual(['Space'])
    expect(bindingsOf('44444444-4444-4444-8444-444444444441')).toEqual([])
    expect(screen.queryByRole('dialog', { name: ru.bindings.dialogTitle })).not.toBeInTheDocument()
  })

  it('«Всё равно привязать» keeps both bindings as a conflict', async () => {
    const user = userEvent.setup()
    await renderApp(data())
    await openFireDialog(user)
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    await user.click(within(bindDialog()).getByRole('button', { name: ru.bindings.confirmAnyway }))
    expect(bindingsOf(FIRE)).toEqual(['Space'])
    expect(input('Space')).toHaveAttribute('data-conflict')
  })

  it('mouse buttons and the wheel are captured over the box', async () => {
    const user = userEvent.setup()
    await renderApp(data())
    await openFireDialog(user)
    const box = within(bindDialog()).getByTestId('capture-box')
    fireEvent.pointerDown(box, { button: 2, pointerId: 1 })
    expect(box).toHaveTextContent('ПКМ')
    fireEvent.pointerDown(box, { button: 0, pointerId: 1 })
    expect(box).toHaveTextContent('ЛКМ')
    fireEvent.pointerDown(box, { button: 3, pointerId: 1, altKey: true })
    expect(box).toHaveTextContent('Alt+Mouse 4')
    fireEvent.wheel(box, { deltaY: 30 })
    expect(box).toHaveTextContent('Колесо вниз')
    await user.click(within(bindDialog()).getByRole('button', { name: ru.bindings.confirm }))
    expect(bindingsOf(FIRE)).toEqual(['WheelDown'])
  })

  it('a blocked key cannot be confirmed; Esc closes without saving', async () => {
    const user = userEvent.setup()
    await renderApp(data())
    await openFireDialog(user)
    fireEvent.pointerDown(input('Fn'), { button: 0, pointerId: 1 })
    expect(within(bindDialog()).getByRole('alert')).toHaveTextContent(
      'Эта клавиша не передаётся в PUBG',
    )
    expect(within(bindDialog()).getByRole('button', { name: ru.bindings.confirm })).toBeDisabled()
    fireEvent.keyDown(window, { code: 'Escape', key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: ru.bindings.dialogTitle })).not.toBeInTheDocument()
    expect(bindingsOf(FIRE)).toEqual([])
  })

  it('«Очистить» and confirm remove the binding', async () => {
    const user = userEvent.setup()
    await renderApp(data())
    const jump = within(panel()).getByRole('group', { name: 'Прыжок' })
    await user.click(within(jump).getByRole('button', { name: /Клавиша 1 действия «Прыжок»/ }))
    await user.click(within(bindDialog()).getByRole('button', { name: ru.bindings.clear }))
    expect(within(bindDialog()).getByTestId('capture-box')).toHaveTextContent('—')
    await user.click(within(bindDialog()).getByRole('button', { name: ru.bindings.confirm }))
    expect(bindingsOf('44444444-4444-4444-8444-444444444441')).toEqual([])
  })

  it('the hint tells which combination a click assigns in the Ctrl layer', async () => {
    const user = userEvent.setup()
    await renderApp(data())
    await user.click(screen.getByRole('radio', { name: /^Ctrl/ }))
    await openFireDialog(user)
    expect(bindDialog()).toHaveTextContent('Клик по экранной клавише назначит Ctrl+…')
    fireEvent.pointerDown(input('KeyW'), { button: 0, pointerId: 1 })
    expect(within(bindDialog()).getByTestId('capture-box')).toHaveTextContent('Ctrl+W')
  })

  it('press type is chosen in the menu and shown in the row', async () => {
    const user = userEvent.setup()
    await renderApp(data())
    const jump = within(panel()).getByRole('group', { name: 'Прыжок' })
    await user.click(within(jump).getByRole('button', { name: /Тип нажатия и параметр/ }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Удержание' }))
    expect(at(profile().bindings, 0).pressType).toBe('hold')
    expect(within(jump).getByRole('button', { name: /Удержание/ })).toBeInTheDocument()
  })

  it('the unbound tab lists actions without a key (FR-17)', async () => {
    const user = userEvent.setup()
    await renderApp(data())
    await user.click(within(panel()).getByRole('tab', { name: ru.panel.tabs.unbound }))
    const list = screen.getByTestId('panel-unbound')
    expect(within(list).queryByRole('group', { name: 'Прыжок' })).not.toBeInTheDocument()
    expect(
      within(list).getByRole('button', { name: /Клавиша 1 действия «Огонь»/ }),
    ).toHaveTextContent(ru.panel.assignKey)
  })
})

describe('search (FR-16)', () => {
  it('finds by Russian and English names and highlights the keys', async () => {
    const user = userEvent.setup()
    await renderApp(data())
    await user.type(within(panel()).getByRole('searchbox', { name: ru.panel.search }), 'JUMP')
    const list = screen.getByTestId('panel-actions')
    expect(within(list).queryByRole('group', { name: 'Огонь' })).not.toBeInTheDocument()
    await user.hover(within(list).getByRole('group', { name: 'Прыжок' }))
    expect(input('Space')).not.toHaveAttribute('data-dimmed')
    expect(input('KeyQ')).toHaveAttribute('data-dimmed')
    await user.unhover(within(list).getByRole('group', { name: 'Прыжок' }))
    expect(input('KeyQ')).not.toHaveAttribute('data-dimmed')
  })
})

describe('key groups (FR-29, FR-30)', () => {
  it('TC-13: W A S D in a green group are green by groups, other keys neutral', async () => {
    const user = userEvent.setup()
    await renderApp(data())
    fireEvent.click(input('KeyW'))
    for (const code of ['KeyA', 'KeyS', 'KeyD']) fireEvent.click(input(code), { ctrlKey: true })
    await user.click(within(panel()).getByRole('button', { name: ru.panel.createGroup }))
    const dialog = screen.getByRole('dialog', { name: ru.keyGroups.createTitle })
    await user.type(within(dialog).getByLabelText(ru.keyGroups.name), 'Движение')
    await user.click(within(dialog).getByRole('radio', { name: '#10B981' }))
    await user.click(within(dialog).getByRole('button', { name: ru.common.create }))
    expect(profile().keyGroups).toMatchObject([
      { name: 'Движение', color: '#10B981', inputs: ['KeyW', 'KeyA', 'KeyS', 'KeyD'] },
    ])

    await user.click(screen.getByRole('radio', { name: ru.bindings.byGroup }))
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
      expect(input(code).style.getPropertyValue('--cap-top')).toBe('#10B981')
    }
    // Пробел с биндом — без цвета: категории в режиме групп не видны
    expect(input('Space').style.getPropertyValue('--cap-top')).not.toBe('#3B82F6')
  })

  it('asks before moving a key from another group', async () => {
    const user = userEvent.setup()
    const game = sampleGame()
    const main = at(game.profiles, 0)
    await renderApp(
      data({
        profiles: [
          {
            ...main,
            keyGroups: [
              {
                id: '99999999-9999-4999-8999-999999999991',
                name: 'Старая',
                color: '#000000',
                inputs: ['KeyQ'],
              },
            ],
          },
        ],
      }),
    )
    fireEvent.click(input('KeyQ'))
    fireEvent.click(input('KeyW'), { ctrlKey: true })
    await user.click(within(panel()).getByRole('button', { name: ru.panel.createGroup }))
    const dialog = screen.getByRole('dialog', { name: ru.keyGroups.createTitle })
    await user.type(within(dialog).getByLabelText(ru.keyGroups.name), 'Новая')
    await user.click(within(dialog).getByRole('button', { name: ru.common.create }))
    const ask = screen.getByRole('alertdialog', { name: ru.keyGroups.moveTitle })
    expect(ask).toHaveTextContent('Q (Старая)')
    await user.click(within(ask).getByRole('button', { name: ru.keyGroups.move }))
    expect(profile().keyGroups.map((g) => [g.name, g.inputs])).toEqual([
      ['Старая', []],
      ['Новая', ['KeyQ', 'KeyW']],
    ])
  })
})

describe('profile settings and notes (FR-18, FR-11)', () => {
  it('TC-08: 150 in the field of a 1–100 slider becomes 100 with a hint', async () => {
    const user = userEvent.setup()
    await renderApp(data())
    await user.click(within(panel()).getByRole('tab', { name: ru.panel.tabs.settings }))
    const field = within(panel()).getByRole('textbox', { name: 'Чувствительность' })
    expect(field).toHaveValue('42')
    await user.clear(field)
    await user.type(field, '150{Enter}')
    expect(profile().settingValues).toMatchObject({ '55555555-5555-4555-8555-555555555551': 100 })
    expect(field).toHaveValue('100')
    expect(within(panel()).getByRole('status')).toHaveTextContent('Допустимо от 1 до 100')
    // Значение не по умолчанию — есть сброс
    await user.click(within(panel()).getByRole('button', { name: /Сбросить/ }))
    expect(field).toHaveValue('50')
  })

  it('notes are saved on blur and before the page closes', async () => {
    const user = userEvent.setup()
    await renderApp(data())
    await user.click(within(panel()).getByRole('tab', { name: ru.panel.tabs.notes }))
    const notes = within(panel()).getByRole('textbox', { name: ru.profiles.notes })
    await user.type(notes, 'Сенса 42')
    expect(profile().notes).toBe('')
    act(() => {
      runFlushHooks()
    })
    expect(profile().notes).toBe('Сенса 42')
    await user.type(notes, '!')
    await user.click(within(panel()).getByRole('tab', { name: ru.panel.tabs.actions }))
    expect(profile().notes).toBe('Сенса 42!')
  })
})

describe('conflict counter in the header (FR-15)', () => {
  it('TC-04: counts one conflict, lists it and jumps to the key', async () => {
    const user = userEvent.setup()
    await renderApp(data())
    expect(screen.getByTestId('issues-button')).toHaveAccessibleName(ru.bindings.noIssues)
    const fire = within(panel()).getByRole('group', { name: 'Огонь' })
    await user.click(within(fire).getByRole('button', { name: /Клавиша 1 действия «Огонь»/ }))
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    await user.click(within(bindDialog()).getByRole('button', { name: ru.bindings.confirmAnyway }))
    expect(screen.getByTestId('issues-button')).toHaveAccessibleName('Конфликты: 1')

    await user.click(screen.getByTestId('issues-button'))
    const list = await screen.findByRole('dialog', { name: ru.bindings.issuesTitle })
    expect(list).toHaveTextContent('Space · Нажатие')
    expect(list).toHaveTextContent('Прыжок, Огонь')
    await user.click(within(list).getByRole('button', { name: /Space/ }))
    expect(input('Space')).toHaveAttribute('data-selected')
    expect(within(panel()).getByRole('heading', { name: 'Space' })).toBeInTheDocument()
  })
})
